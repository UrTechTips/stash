import { validateAllocation } from '../engine/earmarks';
import { isISODate, type ISODate } from '../engine/dates';
import { getAccount } from './accounts';
import { assert, type Db } from './Db';
import { earmarkedOn } from './earmarks';
import { addTransaction } from './transactions';
import type { Goal, GoalInputData, GoalStatus, Minor } from './types';

type Row = {
  id: number;
  name: string;
  price: number;
  type: Goal['type'];
  priority: number;
  target_date: string | null;
  url: string | null;
  created_at: string;
  status: GoalStatus;
  expected_uses: number | null;
  purchased_transaction_id: number | null;
  monthly_plan: number;
  saved: number;
};

const map = (r: Row): Goal => ({
  id: r.id,
  name: r.name,
  price: r.price,
  type: r.type,
  priority: r.priority,
  targetDate: r.target_date,
  url: r.url,
  createdAt: r.created_at,
  status: r.status,
  expectedUses: r.expected_uses,
  purchasedTransactionId: r.purchased_transaction_id,
  monthlyPlan: r.monthly_plan,
  saved: r.saved,
});

const SELECT = `SELECT g.*, COALESCE((SELECT SUM(a.amount) FROM goal_allocations a WHERE a.goal_id = g.id), 0) AS saved FROM goals g`;

export async function listGoals(db: Db, status?: GoalStatus): Promise<Goal[]> {
  const sql = `${SELECT} ${status ? 'WHERE g.status = ?' : ''} ORDER BY g.priority, g.created_at, g.id`;
  return (await db.all<Row>(sql, status ? [status] : [])).map(map);
}

export async function getGoal(db: Db, id: number): Promise<Goal | null> {
  const row = await db.first<Row>(`${SELECT} WHERE g.id = ?`, [id]);
  return row ? map(row) : null;
}

function validate(input: GoalInputData) {
  assert(input.name.trim().length > 0, 'Give the goal a name.');
  assert(Number.isInteger(input.price) && input.price > 0, 'Enter a price greater than zero.');
  assert([1, 2, 3].includes(input.priority), 'Pick a priority.');
  assert(!input.targetDate || isISODate(input.targetDate), 'That target date is not valid.');
  assert(input.expectedUses == null || (Number.isInteger(input.expectedUses) && input.expectedUses > 0), 'Expected uses must be a whole number.');
  assert((input.monthlyPlan ?? 0) >= 0, 'The monthly plan cannot be negative.');
}

export async function createGoal(db: Db, input: GoalInputData, today: ISODate): Promise<number> {
  validate(input);
  const r = await db.run(
    `INSERT INTO goals (name, price, type, priority, target_date, url, created_at, expected_uses, monthly_plan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      input.price,
      input.type,
      input.priority,
      input.targetDate ?? null,
      input.url?.trim() || null,
      today,
      input.expectedUses ?? null,
      input.monthlyPlan ?? 0,
    ],
  );
  return r.lastInsertRowId;
}

export async function updateGoal(db: Db, id: number, input: GoalInputData): Promise<void> {
  validate(input);
  await db.run(
    `UPDATE goals SET name = ?, price = ?, type = ?, priority = ?, target_date = ?, url = ?,
            expected_uses = ?, monthly_plan = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.price,
      input.type,
      input.priority,
      input.targetDate ?? null,
      input.url?.trim() || null,
      input.expectedUses ?? null,
      input.monthlyPlan ?? 0,
      id,
    ],
  );
}

/** Stop saving for a goal. Its earmarked money is released automatically (only active goals hold money). */
export async function dropGoal(db: Db, id: number): Promise<void> {
  await db.run(`UPDATE goals SET status = 'dropped' WHERE id = ?`, [id]);
}

export async function reactivateGoal(db: Db, id: number): Promise<void> {
  await db.run(`UPDATE goals SET status = 'active' WHERE id = ? AND purchased_transaction_id IS NULL`, [id]);
}

export async function deleteGoal(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('UPDATE transactions SET goal_id = NULL WHERE goal_id = ?', [id]);
    await tx.run('DELETE FROM goal_allocations WHERE goal_id = ?', [id]);
    await tx.run('DELETE FROM goals WHERE id = ?', [id]);
  });
}

/** Where a goal's money is held: net amount per account. */
export async function goalAllocations(db: Db, goalId: number): Promise<{ accountId: number; accountName: string; amount: Minor }[]> {
  const rows = await db.all<{ account_id: number; name: string; net: number }>(
    `SELECT a.account_id, ac.name, SUM(a.amount) AS net
       FROM goal_allocations a JOIN accounts ac ON ac.id = a.account_id
      WHERE a.goal_id = ? GROUP BY a.account_id, ac.name HAVING SUM(a.amount) <> 0 ORDER BY ac.id`,
    [goalId],
  );
  return rows.map((r) => ({ accountId: r.account_id, accountName: r.name, amount: r.net }));
}

/**
 * Sets money aside for a goal (positive) or releases it (negative). The money stays in the account;
 * Stash just remembers it is reserved. An account can never have more earmarked than it holds.
 * Returns the goal's new saved total.
 */
export async function allocateToGoal(db: Db, goalId: number, accountId: number, amount: Minor, date: ISODate): Promise<Minor> {
  return db.transaction(async (tx) => {
    const goal = await getGoal(tx, goalId);
    assert(goal && goal.status === 'active', 'That goal is not active.');
    const account = await getAccount(tx, accountId);
    assert(account, 'Pick an account.');

    if (amount < 0) {
      const held = (await goalAllocations(tx, goalId)).find((a) => a.accountId === accountId)?.amount ?? 0;
      assert(-amount <= held, 'This goal does not hold that much in this account.');
    } else {
      const check = validateAllocation(account.balance, await earmarkedOn(tx, accountId), amount);
      assert(check.ok, check.ok ? '' : check.message);
    }
    await tx.run('INSERT INTO goal_allocations (goal_id, account_id, amount, date) VALUES (?, ?, ?, ?)', [
      goalId,
      accountId,
      amount,
      date,
    ]);
    return (await getGoal(tx, goalId))!.saved;
  });
}

/** What was set aside for goals this calendar month, per goal (positive allocations only). */
export async function allocatedInMonth(db: Db, month: string): Promise<Record<number, Minor>> {
  const rows = await db.all<{ goal_id: number; total: number }>(
    `SELECT goal_id, SUM(amount) AS total FROM goal_allocations
      WHERE amount > 0 AND substr(date, 1, 7) = ? GROUP BY goal_id`,
    [month],
  );
  return Object.fromEntries(rows.map((r) => [r.goal_id, r.total]));
}

export interface PurchaseInput {
  accountId: number;
  /** What you actually paid. */
  amount: Minor;
  date: ISODate;
  categoryId?: number | null;
}

/** Marks a goal as bought and records the expense, atomically. */
export async function markGoalBought(db: Db, goalId: number, purchase: PurchaseInput): Promise<number> {
  return db.transaction(async (tx) => {
    const goal = await getGoal(tx, goalId);
    assert(goal && goal.status === 'active', 'That goal is not active.');
    // Release the goal's earmark first so the spend is not blocked by its own reserved money.
    await tx.run(`UPDATE goals SET status = 'bought' WHERE id = ?`, [goalId]);
    const txId = await addTransaction(tx, {
      type: 'expense',
      amount: purchase.amount,
      date: purchase.date,
      accountId: purchase.accountId,
      categoryId: purchase.categoryId ?? null,
      note: goal.name,
      goalId,
    });
    await tx.run('UPDATE goals SET purchased_transaction_id = ? WHERE id = ?', [txId, goalId]);
    return txId;
  });
}
