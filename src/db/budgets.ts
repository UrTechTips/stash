import { assert, type Db } from './Db';
import type { BudgetView, Minor } from './types';

/**
 * The budget that applies to `month` ('YYYY-MM'). A month with no budget of its own uses the most
 * recent earlier one (`inheritedFrom` says which), so the budget "rolls over" without any work.
 */
export async function getBudget(db: Db, month: string): Promise<BudgetView | null> {
  let row = await db.first<{ id: number; month: string; total_amount: number; carry_over: number }>(
    'SELECT * FROM budgets WHERE month = ?',
    [month],
  );
  let inheritedFrom: string | undefined;
  if (!row) {
    row = await db.first('SELECT * FROM budgets WHERE month < ? ORDER BY month DESC LIMIT 1', [month]);
    inheritedFrom = row?.month;
  }
  if (!row) return null;
  const limits = await db.all<{ category_id: number; limit_amount: number }>(
    'SELECT category_id, limit_amount FROM budget_categories WHERE budget_id = ?',
    [row.id],
  );
  return {
    month,
    total: row.total_amount,
    carryOver: row.carry_over === 1,
    limits: Object.fromEntries(limits.map((l) => [l.category_id, l.limit_amount])),
    inheritedFrom,
  };
}

export interface BudgetInput {
  total: Minor;
  carryOver: boolean;
  limits: Record<number, Minor>;
}

/** Saves the budget for one month. Per-category limits are replaced as a set. */
export async function setBudget(db: Db, month: string, input: BudgetInput): Promise<void> {
  assert(/^\d{4}-\d{2}$/.test(month), 'That month is not valid.');
  assert(Number.isInteger(input.total) && input.total >= 0, 'Enter a monthly budget of zero or more.');
  const limits = Object.entries(input.limits).filter(([, v]) => v > 0);
  for (const [, v] of limits) assert(Number.isInteger(v), 'Limits must be whole numbers of paise.');

  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO budgets (month, total_amount, carry_over) VALUES (?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET total_amount = excluded.total_amount, carry_over = excluded.carry_over`,
      [month, input.total, input.carryOver ? 1 : 0],
    );
    const row = await tx.first<{ id: number }>('SELECT id FROM budgets WHERE month = ?', [month]);
    await tx.run('DELETE FROM budget_categories WHERE budget_id = ?', [row!.id]);
    for (const [categoryId, amount] of limits) {
      await tx.run('INSERT INTO budget_categories (budget_id, category_id, limit_amount) VALUES (?, ?, ?)', [
        row!.id,
        Number(categoryId),
        amount,
      ]);
    }
  });
}
