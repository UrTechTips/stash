import { beforeEach, describe, expect, it } from 'vitest';
import { advance, materializeDue, occurrencesBetween, createRule, listRules } from './recurring';
import { createAccount, getAccount, listAccounts, summarizeAccounts } from './accounts';
import { getBudget, setBudget } from './budgets';
import { listCategories } from './categories';
import { ValidationError, type Db } from './Db';
import { allocateToGoal, createGoal, getGoal, goalAllocations, listGoals, markGoalBought, dropGoal } from './goals';
import { LATEST_VERSION, MIGRATIONS, currentVersion, migrate } from './migrations';
import { seedIfEmpty } from './seed';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { openMemoryDb } from './testing';
import { addTransaction, deleteTransaction, getTransaction, listTransactions, updateTransaction } from './transactions';
import { earmarkedByAccount } from './earmarks';

const rupees = (n: number) => n * 100;
let db: Db;
let cash: number, bank: number;
let food: number, rent: number, salary: number;

beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
  await seedIfEmpty(db);
  cash = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: rupees(1_000) });
  bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalance: rupees(20_000) });
  const cats = await listCategories(db);
  food = cats.find((c) => c.name === 'Eating out')!.id;
  rent = cats.find((c) => c.name === 'Rent')!.id;
  salary = cats.find((c) => c.name === 'Salary')!.id;
});

const expense = (amount: number, over = {}) =>
  addTransaction(db, { type: 'expense', amount: rupees(amount), date: '2026-10-10', accountId: bank, categoryId: food, ...over });

describe('migrations', () => {
  it('creates the latest schema on a fresh database and seeds categories once', async () => {
    expect(await currentVersion(db)).toBe(LATEST_VERSION);
    expect((await listCategories(db)).length).toBeGreaterThan(8);
    await seedIfEmpty(db);
    const names = (await listCategories(db)).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('upgrades an existing database from the previous version without losing data, after a backup hook', async () => {
    const old = openMemoryDb();
    // build a database that is still at version 1
    await old.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
    await old.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[0].sql);
      await tx.run('INSERT INTO schema_version (version) VALUES (1)');
    });
    await old.run("INSERT INTO accounts (name, type, opening_balance) VALUES ('Old', 'bank', 12345)");

    const calls: [number, number][] = [];
    const version = await migrate(old, { beforeMigrate: async (from, to) => void calls.push([from, to]) });

    expect(version).toBe(LATEST_VERSION);
    expect(calls).toEqual([[1, LATEST_VERSION]]);
    expect((await listAccounts(old))[0]).toMatchObject({ name: 'Old', balance: 12345 });
    // running again does nothing
    calls.length = 0;
    await migrate(old, { beforeMigrate: async (f, t) => void calls.push([f, t]) });
    expect(calls).toEqual([]);
  });

  it('does not call the backup hook on a brand-new database', async () => {
    const fresh = openMemoryDb();
    let called = false;
    await migrate(fresh, { beforeMigrate: async () => void (called = true) });
    expect(called).toBe(false);
  });
});

describe('balances are derived, never stored', () => {
  it('equal opening balance plus transactions, with transfers moving money between accounts', async () => {
    await expense(500);
    await addTransaction(db, { type: 'income', amount: rupees(30_000), date: '2026-10-01', accountId: bank, categoryId: salary });
    await addTransaction(db, { type: 'transfer', amount: rupees(2_000), date: '2026-10-11', accountId: bank, toAccountId: cash });

    expect((await getAccount(db, bank))!.balance).toBe(rupees(20_000 - 500 + 30_000 - 2_000));
    expect((await getAccount(db, cash))!.balance).toBe(rupees(1_000 + 2_000));
  });

  it('transfers never count as spending or income', async () => {
    await addTransaction(db, { type: 'transfer', amount: rupees(2_000), date: '2026-10-11', accountId: bank, toAccountId: cash });
    const total = summarizeAccounts(await listAccounts(db));
    expect(total.netWorth).toBe(rupees(21_000));
    const rows = await db.all("SELECT type FROM transactions WHERE type != 'transfer'");
    expect(rows).toEqual([]);
  });

  it('editing and deleting a transaction updates balances', async () => {
    const id = await expense(500);
    await updateTransaction(db, id, { type: 'expense', amount: rupees(800), date: '2026-10-10', accountId: cash, categoryId: food });
    expect((await getAccount(db, bank))!.balance).toBe(rupees(20_000));
    expect((await getAccount(db, cash))!.balance).toBe(rupees(200));
    await deleteTransaction(db, id);
    expect((await getAccount(db, cash))!.balance).toBe(rupees(1_000));
  });

  it('credit cards go negative and net worth reflects it, but liquid money does not', async () => {
    const card = await createAccount(db, { name: 'Card', type: 'credit', openingBalance: 0 });
    await addTransaction(db, { type: 'expense', amount: rupees(3_000), date: '2026-10-10', accountId: card, categoryId: food });
    const s = summarizeAccounts(await listAccounts(db));
    expect(s.netWorth).toBe(rupees(21_000 - 3_000));
    expect(s.liquid).toBe(rupees(21_000)); // credit cards are not spendable by default
  });
});

describe('transactions are validated and atomic', () => {
  it('rejects bad input with a readable message', async () => {
    await expect(expense(0)).rejects.toThrow(ValidationError);
    await expect(expense(-5)).rejects.toThrow('greater than zero');
    await expect(addTransaction(db, { type: 'transfer', amount: 100, date: '2026-10-10', accountId: bank, toAccountId: bank })).rejects.toThrow('two different accounts');
    await expect(addTransaction(db, { type: 'expense', amount: 100, date: '2026-13-40', accountId: bank })).rejects.toThrow('date');
    await expect(addTransaction(db, { type: 'expense', amount: 100, date: '2026-10-10', accountId: bank, categoryId: salary })).rejects.toThrow('expense category');
    await expect(addTransaction(db, { type: 'income', amount: 100, date: '2026-10-10', accountId: bank, categoryId: food })).rejects.toThrow('income category');
  });

  it('a failed multi-step write leaves nothing behind', async () => {
    await expect(
      db.transaction(async (tx) => {
        await addTransaction(tx, { type: 'transfer', amount: rupees(100), date: '2026-10-10', accountId: bank, toAccountId: cash });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await listTransactions(db)).toEqual([]);
    expect((await getAccount(db, bank))!.balance).toBe(rupees(20_000));
  });

  it('filters and searches', async () => {
    await expense(100, { note: 'Biryani with friends' });
    await expense(200, { note: 'Coffee', accountId: cash, date: '2026-09-02' });
    await addTransaction(db, { type: 'income', amount: rupees(5), date: '2026-10-12', accountId: bank, categoryId: salary });
    expect((await listTransactions(db, { search: 'biryani' })).length).toBe(1);
    expect((await listTransactions(db, { accountId: cash })).length).toBe(1);
    expect((await listTransactions(db, { from: '2026-10-01', to: '2026-10-31' })).length).toBe(2);
    expect((await listTransactions(db, { type: 'income' }))[0].categoryName).toBe('Salary');
    expect((await listTransactions(db, { search: '50%' })).length).toBe(0); // % is literal, not a wildcard
    expect((await listTransactions(db, { limit: 1 })).length).toBe(1);
  });
});

describe('goals, earmarks and purchases', () => {
  it('earmarks never exceed an account balance', async () => {
    const g = await createGoal(db, { name: 'Keyboard', price: rupees(3_000), type: 'want', priority: 2 }, '2026-10-01');
    await allocateToGoal(db, g, cash, rupees(1_000), '2026-10-02');
    await expect(allocateToGoal(db, g, cash, rupees(1), '2026-10-02')).rejects.toThrow('free money');
    await allocateToGoal(db, g, bank, rupees(2_000), '2026-10-02');
    expect((await getGoal(db, g))!.saved).toBe(rupees(3_000));
    // releasing money is always allowed, up to what the goal holds
    await allocateToGoal(db, g, bank, -rupees(500), '2026-10-03');
    await expect(allocateToGoal(db, g, bank, -rupees(2_000), '2026-10-03')).rejects.toThrow('does not hold');
    expect((await goalAllocations(db, g)).find((a) => a.accountId === bank)!.amount).toBe(rupees(1_500));
  });

  it('two goals share one account without over-reserving it', async () => {
    const a = await createGoal(db, { name: 'A', price: rupees(9_000), type: 'want', priority: 1 }, '2026-10-01');
    const b = await createGoal(db, { name: 'B', price: rupees(9_000), type: 'want', priority: 2 }, '2026-10-01');
    await allocateToGoal(db, a, cash, rupees(600), '2026-10-02');
    await expect(allocateToGoal(db, b, cash, rupees(500), '2026-10-02')).rejects.toThrow('free money');
    await allocateToGoal(db, b, cash, rupees(400), '2026-10-02');
    expect((await earmarkedByAccount(db))[cash]).toBe(rupees(1_000));
  });

  it('spending earmarked money releases the lowest-priority goal first', async () => {
    const high = await createGoal(db, { name: 'High', price: rupees(900), type: 'want', priority: 1 }, '2026-10-01');
    const low = await createGoal(db, { name: 'Low', price: rupees(900), type: 'want', priority: 3 }, '2026-10-01');
    await allocateToGoal(db, high, cash, rupees(500), '2026-10-02');
    await allocateToGoal(db, low, cash, rupees(500), '2026-10-02');
    // cash holds 1,000, all reserved. Spending 300 from cash must shrink the earmarks to 700.
    await addTransaction(db, { type: 'expense', amount: rupees(300), date: '2026-10-05', accountId: cash, categoryId: food });
    expect((await getGoal(db, low))!.saved).toBe(rupees(200));
    expect((await getGoal(db, high))!.saved).toBe(rupees(500));
    expect((await earmarkedByAccount(db))[cash]).toBeLessThanOrEqual(rupees(700));
  });

  it('buying a goal records the expense and marks it bought in one step', async () => {
    const g = await createGoal(db, { name: 'Keyboard', price: rupees(3_000), type: 'want', priority: 2 }, '2026-10-01');
    await allocateToGoal(db, g, bank, rupees(3_000), '2026-10-02');
    const txId = await markGoalBought(db, g, { accountId: bank, amount: rupees(2_800), date: '2026-10-10', categoryId: food });
    const goal = (await getGoal(db, g))!;
    expect(goal.status).toBe('bought');
    expect(goal.purchasedTransactionId).toBe(txId);
    expect((await getTransaction(db, txId))).toMatchObject({ goalId: g, amount: rupees(2_800), note: 'Keyboard' });
    expect((await getAccount(db, bank))!.balance).toBe(rupees(17_200));
    expect((await earmarkedByAccount(db))[bank] ?? 0).toBe(0); // a bought goal holds nothing
    // deleting the purchase makes the goal active again
    await deleteTransaction(db, txId);
    expect((await getGoal(db, g))!.status).toBe('active');
  });

  it('dropping a goal releases its money', async () => {
    const g = await createGoal(db, { name: 'Gone', price: rupees(900), type: 'gift', priority: 3 }, '2026-10-01');
    await allocateToGoal(db, g, cash, rupees(900), '2026-10-02');
    await dropGoal(db, g);
    expect((await earmarkedByAccount(db))[cash] ?? 0).toBe(0);
    expect((await listGoals(db, 'active')).length).toBe(0);
  });

  it('validates goal input', async () => {
    await expect(createGoal(db, { name: ' ', price: 100, type: 'want', priority: 2 }, '2026-10-01')).rejects.toThrow('name');
    await expect(createGoal(db, { name: 'X', price: 0, type: 'want', priority: 2 }, '2026-10-01')).rejects.toThrow('price');
    await expect(createGoal(db, { name: 'X', price: 100, type: 'want', priority: 9 }, '2026-10-01')).rejects.toThrow('priority');
  });
});

describe('budgets', () => {
  it('a month without its own budget inherits the latest earlier one', async () => {
    await setBudget(db, '2026-09', { total: rupees(30_000), carryOver: true, limits: { [food]: rupees(4_000) } });
    const oct = (await getBudget(db, '2026-10'))!;
    expect(oct).toMatchObject({ total: rupees(30_000), carryOver: true, inheritedFrom: '2026-09' });
    expect(oct.limits[food]).toBe(rupees(4_000));

    await setBudget(db, '2026-10', { total: rupees(35_000), carryOver: false, limits: { [rent]: rupees(12_000) } });
    const own = (await getBudget(db, '2026-10'))!;
    expect(own.inheritedFrom).toBeUndefined();
    expect(own.limits).toEqual({ [rent]: rupees(12_000) });
    expect((await getBudget(db, '2026-08'))).toBeNull();
  });
});

describe('recurring rules', () => {
  it('advances monthly rules but sticks to the anchor day', () => {
    expect(advance('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(advance('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(advance('2026-10-14', 'weekly', 14)).toBe('2026-10-21');
    expect(advance('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
  });

  it('creates every due occurrence as a real transaction, once', async () => {
    const id = await createRule(db, { type: 'expense', amount: rupees(12_000), accountId: bank, categoryId: rent, note: 'Rent', cadence: 'monthly', startDate: '2026-08-05' });
    const created = await materializeDue(db, '2026-10-14');
    expect(created).toBe(3); // Aug 5, Sep 5, Oct 5
    expect((await listRules(db))[0].nextDue).toBe('2026-11-05');
    expect((await getAccount(db, bank))!.balance).toBe(rupees(20_000 - 36_000));
    expect((await listTransactions(db, { categoryId: rent })).every((t) => t.recurringId === id)).toBe(true);
    expect(await materializeDue(db, '2026-10-14')).toBe(0); // idempotent
  });

  it('lists upcoming occurrences in a window', async () => {
    await createRule(db, { type: 'expense', amount: rupees(500), accountId: bank, cadence: 'weekly', startDate: '2026-10-15', note: 'Gym' });
    await createRule(db, { type: 'income', amount: rupees(30_000), accountId: bank, cadence: 'monthly', startDate: '2026-10-30', categoryId: salary });
    const occ = occurrencesBetween(await listRules(db), '2026-10-15', '2026-10-31');
    expect(occ.map((o) => o.date)).toEqual(['2026-10-15', '2026-10-22', '2026-10-29', '2026-10-30']);
  });
});

describe('settings', () => {
  it('round-trips values, including the open-ended last tier', async () => {
    expect((await loadSettings(db)).bufferMonths).toBe(1);
    const tiers = DEFAULT_SETTINGS.tiers.map((t) => ({ ...t }));
    tiers[1].multiple = 2.5;
    await saveSettings(db, { bufferMonths: 3, tiers, currencySymbol: '$', indianGrouping: false });
    const s = await loadSettings(db);
    expect(s).toMatchObject({ bufferMonths: 3, currencySymbol: '$', indianGrouping: false });
    expect(s.tiers[1].multiple).toBe(2.5);
    expect(s.tiers[3].maxPercent).toBe(Infinity);
    await saveSettings(db, { bufferMonths: 2 });
    expect((await loadSettings(db)).currencySymbol).toBe('$'); // partial saves keep the rest
  });
});
