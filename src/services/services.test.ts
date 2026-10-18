import { beforeEach, describe, expect, it } from 'vitest';
import { createAccount, listAccounts } from '../db/accounts';
import { getBudget, setBudget } from '../db/budgets';
import { listCategories } from '../db/categories';
import type { Db } from '../db/Db';
import { ValidationError } from '../db/Db';
import { allocateToGoal, createGoal, listGoals, markGoalBought } from '../db/goals';
import { createRule } from '../db/recurring';
import { saveSettings, loadSettings } from '../db/settings';
import { openMemoryDb } from '../db/testing';
import { addTransaction, listTransactions } from '../db/transactions';
import { setCurrency, INR } from '../lib/money';
import { boot } from './bootstrap';
import { exportData, importData, transactionsCsv } from './backup';
import { loadContext } from './context';
import { evaluateAll, topGoal, verdictFor, whatIf } from './goals';
import { loadInsights } from './insights';
import { planReminders } from './reminders';

const rupees = (n: number) => n * 100;
const TODAY = '2026-10-14';
let db: Db;
let bank: number, cash: number;
let cat: Record<string, number>;

beforeEach(async () => {
  setCurrency(INR);
  db = openMemoryDb();
  await boot(db, TODAY);
  bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalance: rupees(14_500) });
  cash = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: 0 });
  cat = Object.fromEntries((await listCategories(db)).map((c) => [c.name, c.id]));
});

/** The keyboard example from the project doc, built through the real database. */
async function keyboardScenario() {
  await saveSettings(db, { essentialsEstimate: rupees(10_000), incomeEstimate: rupees(25_000), savingRateEstimate: rupees(4_000), onboarded: true });
  await setBudget(db, '2026-10', { total: rupees(30_000), carryOver: false, limits: { [cat['Games']]: rupees(1_800) } });
  await createRule(db, { type: 'expense', amount: rupees(2_000), accountId: bank, categoryId: cat['Bills'], note: 'Broadband', cadence: 'monthly', startDate: '2026-10-20' });
  await createRule(db, { type: 'income', amount: rupees(25_000), accountId: bank, categoryId: cat['Salary'], note: 'Stipend', cadence: 'monthly', startDate: '2026-10-31' });
  const goalId = await createGoal(db, { name: 'Mechanical keyboard', price: rupees(3_000), type: 'want', priority: 2 }, '2026-10-05');
  await allocateToGoal(db, goalId, bank, rupees(3_000), '2026-10-06');
  return goalId;
}

describe('acceptance: a fully funded but unsafe goal shows Don\'t buy with the exact reason', () => {
  it('reproduces the doc example end to end', async () => {
    await keyboardScenario();
    const ctx = await loadContext(db, TODAY);
    expect(ctx.liquid).toBe(rupees(14_500));
    expect(ctx.snapshot.upcomingObligations).toBe(rupees(2_000));
    expect(ctx.snapshot.discretionaryRemaining).toBe(rupees(1_800));

    const [{ goal, verdict }] = evaluateAll(ctx);
    expect(goal.saved).toBe(rupees(3_000)); // fully funded...
    expect(verdict.status).toBe('dont_buy'); // ...but not safe to spend
    expect(verdict.checks.find((c) => c.id === 'safety')!.message).toBe(
      'Safety: you would end ₹500 below your buffer plus upcoming bills',
    );
    expect(verdict.shortfall).toBe(rupees(3_500));
    expect(topGoal(evaluateAll(ctx))!.goal.id).toBe(goal.id);
  });

  it('changing a buffer or tier setting changes the verdict immediately', async () => {
    const id = await keyboardScenario();
    await addTransaction(db, { type: 'income', amount: rupees(3_500), date: TODAY, accountId: bank, categoryId: cat['Salary'] });
    let ctx = await loadContext(db, TODAY);
    const goal = ctx.goals.find((g) => g.id === id)!;
    expect(verdictFor(ctx, goal).status).toBe('buy_now');

    await saveSettings(db, { bufferMonths: 2 });
    ctx = await loadContext(db, TODAY);
    expect(verdictFor(ctx, goal).status).toBe('dont_buy');

    await saveSettings(db, { bufferMonths: 1 });
    const tiers = (await loadSettings(db)).tiers.map((t) => ({ ...t }));
    tiers[1].multiple = 3; // medium tier now wants a 3x cushion
    await saveSettings(db, { tiers });
    ctx = await loadContext(db, TODAY);
    expect(verdictFor(ctx, goal).status).toBe('keep_saving');
  });

  it('the what-if saving rate moves the estimated date', async () => {
    const id = await keyboardScenario();
    const ctx = await loadContext(db, TODAY);
    const goal = ctx.goals.find((g) => g.id === id)!;
    const base = verdictFor(ctx, goal);
    const better = whatIf(ctx, goal, rupees(4_000));
    expect(better.etaDate! < base.etaDate!).toBe(true);
  });
});

describe('daily allowance', () => {
  it('updates immediately after any transaction', async () => {
    await setBudget(db, '2026-10', { total: rupees(31_000), carryOver: false, limits: {} });
    await createRule(db, { type: 'expense', amount: rupees(2_000), accountId: bank, categoryId: cat['Bills'], note: 'Broadband', cadence: 'monthly', startDate: '2026-10-20' });

    const before = (await loadContext(db, TODAY)).allowance;
    // (31,000 - 2,000 unpaid bill) over the 18 days left including today
    expect(before.allowance).toBe(Math.floor(rupees(29_000) / 18));
    expect(before.remainingToday).toBe(before.allowance);

    await addTransaction(db, { type: 'expense', amount: rupees(400), date: TODAY, accountId: bank, categoryId: cat['Eating out'] });
    const after = (await loadContext(db, TODAY)).allowance;
    expect(after.remainingToday).toBe(before.allowance - rupees(400));
  });

  it('transfers and goal purchases do not count as spending', async () => {
    await setBudget(db, '2026-10', { total: rupees(31_000), carryOver: false, limits: {} });
    await addTransaction(db, { type: 'transfer', amount: rupees(2_000), date: TODAY, accountId: bank, toAccountId: cash });
    const g = await createGoal(db, { name: 'Headphones', price: rupees(2_000), type: 'want', priority: 2 }, '2026-10-01');
    await markGoalBought(db, g, { accountId: bank, amount: rupees(2_000), date: TODAY });
    const ctx = await loadContext(db, TODAY);
    expect(ctx.spentThisMonth).toBe(0);
    expect(ctx.allowance.remainingToday).toBe(ctx.allowance.allowance);
  });

  it("a bill that falls due today does not wreck today's number", async () => {
    await setBudget(db, '2026-10', { total: rupees(31_000), carryOver: false, limits: {} });
    await createRule(db, { type: 'expense', amount: rupees(12_000), accountId: bank, categoryId: cat['Rent'], note: 'Rent', cadence: 'monthly', startDate: TODAY });
    const unpaid = await loadContext(db, TODAY); // nothing has happened yet: the bill is due but not created
    await boot(db, TODAY); // opening the app creates it
    const paid = await loadContext(db, TODAY);
    expect(paid.allowance.remainingToday).toBeGreaterThan(0);
    expect(paid.allowance.allowance).toBe(Math.floor(rupees(31_000 - 12_000) / 18));
    expect(paid.spentThisMonth).toBe(rupees(12_000));
    expect(unpaid.spentThisMonth).toBe(0);
  });

  it('carries unspent budget over when asked', async () => {
    await setBudget(db, '2026-09', { total: rupees(30_000), carryOver: false, limits: {} });
    await addTransaction(db, { type: 'expense', amount: rupees(25_000), date: '2026-09-15', accountId: bank, categoryId: cat['Rent'] });
    await setBudget(db, '2026-10', { total: rupees(31_000), carryOver: true, limits: {} });
    const ctx = await loadContext(db, TODAY);
    expect(ctx.carryOver).toBe(rupees(5_000));
    expect(ctx.budgetTotal).toBe(rupees(36_000));
  });

  it('reports over-budget instead of a negative number', async () => {
    await setBudget(db, '2026-10', { total: rupees(5_000), carryOver: false, limits: {} });
    await addTransaction(db, { type: 'expense', amount: rupees(6_500), date: '2026-10-10', accountId: bank, categoryId: cat['Shopping'] });
    const { allowance } = await loadContext(db, TODAY);
    expect(allowance.overBudgetBy).toBe(rupees(1_500));
    expect(allowance.allowance).toBe(0);
  });

  it('planned goal contributions reduce the allowance until you set the money aside', async () => {
    await setBudget(db, '2026-10', { total: rupees(31_000), carryOver: false, limits: {} });
    const g = await createGoal(db, { name: 'Trip', price: rupees(9_000), type: 'want', priority: 2, monthlyPlan: rupees(3_000) }, '2026-10-01');
    const planned = await loadContext(db, TODAY);
    expect(planned.allowance.allowance).toBe(Math.floor(rupees(28_000) / 18));
    await allocateToGoal(db, g, bank, rupees(3_000), TODAY);
    const done = await loadContext(db, TODAY);
    expect(done.allowance.allowance).toBe(Math.floor(rupees(31_000) / 18));
  });
});

describe('history-based averages', () => {
  it('uses the last 3 months of real transactions once they exist', async () => {
    for (const [m, income, essentials, fun] of [['2026-07', 30_000, 12_000, 4_000], ['2026-08', 30_000, 10_000, 6_000], ['2026-09', 30_000, 11_000, 5_000]] as const) {
      await addTransaction(db, { type: 'income', amount: rupees(income), date: `${m}-01`, accountId: bank, categoryId: cat['Salary'] });
      await addTransaction(db, { type: 'expense', amount: rupees(essentials), date: `${m}-05`, accountId: bank, categoryId: cat['Rent'] });
      await addTransaction(db, { type: 'expense', amount: rupees(fun), date: `${m}-20`, accountId: bank, categoryId: cat['Games'] });
    }
    const { snapshot } = await loadContext(db, TODAY);
    expect(snapshot.essentialsMonthlyAvg).toBe(rupees(11_000));
    expect(snapshot.monthlyIncomeAvg).toBe(rupees(30_000));
    expect(snapshot.monthlySavingRate).toBe(rupees(30_000 - 11_000 - 5_000)); // 14,000
  });

  it('falls back to the estimates from setup for a new user', async () => {
    await saveSettings(db, { incomeEstimate: rupees(25_000), essentialsEstimate: rupees(9_000), savingRateEstimate: rupees(3_000) });
    const { snapshot } = await loadContext(db, TODAY);
    expect(snapshot).toMatchObject({ monthlyIncomeAvg: rupees(25_000), essentialsMonthlyAvg: rupees(9_000), monthlySavingRate: rupees(3_000) });
  });
});

describe('export and re-import lose nothing', () => {
  async function populate() {
    await keyboardScenario();
    await addTransaction(db, { type: 'expense', amount: rupees(250.5 * 1), date: '2026-10-10', accountId: bank, categoryId: cat['Groceries'], note: 'Weekly "big" shop, Reliance' });
    await addTransaction(db, { type: 'transfer', amount: rupees(500), date: '2026-10-11', accountId: bank, toAccountId: cash });
    await saveSettings(db, { currencySymbol: '₹', bufferMonths: 2 });
  }

  it('round-trips everything through JSON', async () => {
    await populate();
    const file = JSON.parse(JSON.stringify(await exportData(db)));

    const fresh = openMemoryDb();
    await boot(fresh, TODAY);
    const summary = await importData(fresh, file);
    expect(summary.accounts).toBe(2);

    const same = async <T,>(f: (d: Db) => Promise<T>) => expect(await f(fresh)).toEqual(await f(db));
    await same((d) => listAccounts(d, { includeArchived: true }));
    await same((d) => listTransactions(d));
    await same((d) => listGoals(d));
    await same((d) => getBudget(d, '2026-10'));
    await same((d) => loadSettings(d));
    await same(async (d) => (await loadContext(d, TODAY)).allowance);
    // and the data keeps working: new rows get fresh ids
    const id = await addTransaction(fresh, { type: 'expense', amount: 100, date: TODAY, accountId: bank, categoryId: cat['Groceries'] });
    expect(id).toBeGreaterThan(Math.max(...(await listTransactions(db)).map((t) => t.id)));
  });

  it('rejects files that are not backups, or are from a newer version', async () => {
    await expect(importData(db, { hello: 'world' })).rejects.toThrow('not a Stash backup');
    const file = await exportData(db);
    await expect(importData(db, { ...file, schema: 99 })).rejects.toThrow('newer version');
  });

  it('leaves the database untouched if an import fails halfway', async () => {
    await populate();
    const before = await listTransactions(db);
    const file = await exportData(db);
    file.tables.transactions.push({ id: 9999, type: 'expense', amount: 100, date: '2026-10-10', account_id: 424242, note: '', created_at: 'x' });
    await expect(importData(db, file)).rejects.toThrow();
    expect(await listTransactions(db)).toEqual(before);
    expect((await listAccounts(db)).length).toBe(2);
  });

  it('refuses an inconsistent backup even when the database does not enforce foreign keys', async () => {
    await populate();
    const file = await exportData(db);
    file.tables.transactions.push({ id: 9999, type: 'expense', amount: 100, date: '2026-10-10', account_id: 424242, note: '', created_at: 'x' });
    const lax = openMemoryDb({ foreignKeys: false }); // like a connection with enforcement off
    await boot(lax, TODAY);
    await createAccount(lax, { name: 'Keep me', type: 'cash', openingBalance: 100 });
    await expect(importData(lax, file)).rejects.toThrow('inconsistent');
    expect((await listAccounts(lax)).map((a) => a.name)).toEqual(['Keep me']); // rolled back
  });

  it('exports a spreadsheet-friendly CSV with correct quoting', async () => {
    await populate();
    const csv = (await transactionsCsv(db)).split('\n');
    expect(csv[0]).toBe('Date,Type,Amount,Account,To account,Category,Note');
    expect(csv).toContain('2026-10-10,expense,250.50,HDFC,,Groceries,"Weekly ""big"" shop, Reliance"');
    expect(csv).toContain('2026-10-11,transfer,500.00,HDFC,Cash,,');
  });
});

describe('insights', () => {
  it('summarises six months, saving rate and where discretionary money went', async () => {
    for (const [m, income, spend] of [['2026-08', 30_000, 24_000], ['2026-09', 30_000, 21_000]] as const) {
      await addTransaction(db, { type: 'income', amount: rupees(income), date: `${m}-01`, accountId: bank, categoryId: cat['Salary'] });
      await addTransaction(db, { type: 'expense', amount: rupees(spend), date: `${m}-10`, accountId: bank, categoryId: cat['Rent'] });
    }
    await addTransaction(db, { type: 'expense', amount: rupees(900), date: '2026-10-03', accountId: bank, categoryId: cat['Eating out'], note: 'Biryani House' });
    await addTransaction(db, { type: 'expense', amount: rupees(300), date: '2026-10-08', accountId: bank, categoryId: cat['Eating out'], note: 'biryani house' });
    await addTransaction(db, { type: 'expense', amount: rupees(700), date: '2026-10-09', accountId: bank, categoryId: cat['Games'] });
    const i = await loadInsights(db, TODAY);
    expect(i.months.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(i.avgSavingRate).toBeCloseTo((0.2 + 0.3) / 2);
    expect(i.avgSaved).toBe(rupees(7_500));
    expect(i.thisMonth[0]).toMatchObject({ name: 'Eating out', total: rupees(1_200) });
    expect(i.topPlaces[0]).toMatchObject({ total: rupees(1_200) }); // "Biryani House" and "biryani house" merge
    expect(i.topPlaces.map((p) => p.label)).toContain('Games');
  });
});

describe('reminders', () => {
  it('plans a bill reminder the day before and a goal nudge on its ETA date', async () => {
    await keyboardScenario();
    const ctx = await loadContext(db, TODAY);
    const plan = await planReminders(db, ctx, { bills: true, goals: true });
    expect(plan.find((p) => p.id.startsWith('bill-'))).toMatchObject({ date: '2026-10-19', title: 'Broadband is due tomorrow' });
    expect(plan.find((p) => p.id.startsWith('goal-'))?.title).toBe('Mechanical keyboard should be safe to buy');
    expect(await planReminders(db, ctx, { bills: false, goals: false })).toEqual([]);
  });
});

describe('bootstrap', () => {
  it('reports a first run until an account exists, and applies the saved currency', async () => {
    const fresh = openMemoryDb();
    expect((await boot(fresh, TODAY)).firstRun).toBe(true);
    await saveSettings(fresh, { currencySymbol: '$', indianGrouping: false });
    await createAccount(fresh, { name: 'A', type: 'cash', openingBalance: 0 });
    expect((await boot(fresh, TODAY)).firstRun).toBe(false);
    const { formatMoney } = await import('../lib/money');
    expect(formatMoney(123_456_700)).toBe('$1,234,567');
  });
});
