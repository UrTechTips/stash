import type { ISODate } from '../engine/dates';
import type { Db } from '../db/Db';
import type { CategoryKind, Minor } from '../db/types';

/** All the read-only aggregate queries. Money is always integer minor units. */

/** Spending that counts against the monthly budget: expenses, minus goal purchases (those are funded by earmarks). */
export async function budgetedSpend(db: Db, from: ISODate, to: ISODate): Promise<Minor> {
  const row = await db.first<{ n: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS n FROM transactions
      WHERE type = 'expense' AND goal_id IS NULL AND date >= ? AND date <= ?`,
    [from, to],
  );
  return row?.n ?? 0;
}

/**
 * The split the daily allowance needs. Bills that fell due today (they came from a recurring rule)
 * count as already paid at the start of the day, so a rent payment does not wreck today's number.
 */
export async function spendSplit(db: Db, monthStart: ISODate, today: ISODate): Promise<{ before: Minor; today: Minor }> {
  const row = await db.first<{ before: number; today: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN date < ? OR recurring_id IS NOT NULL THEN amount ELSE 0 END), 0) AS before,
       COALESCE(SUM(CASE WHEN date = ? AND recurring_id IS NULL THEN amount ELSE 0 END), 0) AS today
       FROM transactions
      WHERE type = 'expense' AND goal_id IS NULL AND date >= ? AND date <= ?`,
    [today, today, monthStart, today],
  );
  return { before: row?.before ?? 0, today: row?.today ?? 0 };
}

export interface CategorySpend {
  categoryId: number | null;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind | null;
  total: Minor;
}

export async function spendByCategory(
  db: Db,
  from: ISODate,
  to: ISODate,
  opts: { budgetedOnly?: boolean } = {},
): Promise<CategorySpend[]> {
  const rows = await db.all<{ id: number | null; name: string | null; icon: string | null; color: string | null; kind: CategoryKind | null; total: number }>(
    `SELECT c.id, c.name, c.icon, c.color, c.kind, SUM(t.amount) AS total
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ? ${opts.budgetedOnly ? 'AND t.goal_id IS NULL' : ''}
      GROUP BY c.id ORDER BY total DESC`,
    [from, to],
  );
  return rows.map((r) => ({
    categoryId: r.id,
    name: r.name ?? 'Uncategorised',
    icon: r.icon ?? '🏷️',
    color: r.color ?? '#8A6D3B',
    kind: r.kind,
    total: r.total,
  }));
}

export interface MonthTotals {
  month: string;
  income: Minor;
  expense: Minor;
  essential: Minor;
  discretionary: Minor;
}

/** Income and spending per calendar month. Months with no transactions are missing from the result. */
export async function monthlyTotals(db: Db, from: ISODate, to: ISODate): Promise<MonthTotals[]> {
  return db.all<MonthTotals>(
    `SELECT substr(t.date, 1, 7) AS month,
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN t.type = 'expense' AND c.kind = 'essential' THEN t.amount ELSE 0 END), 0) AS essential,
            COALESCE(SUM(CASE WHEN t.type = 'expense' AND c.kind = 'discretionary' THEN t.amount ELSE 0 END), 0) AS discretionary
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.date >= ? AND t.date <= ?
      GROUP BY month ORDER BY month`,
    [from, to],
  );
}

/** Where discretionary money went. A note ("Biryani House") counts as the place; no note falls back to the category. */
export async function topPlaces(db: Db, from: ISODate, to: ISODate, limit = 3): Promise<{ label: string; total: Minor }[]> {
  return db.all<{ label: string; total: number }>(
    `SELECT CASE WHEN TRIM(t.note) <> '' THEN TRIM(t.note) ELSE c.name END AS label, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.type = 'expense' AND c.kind = 'discretionary' AND t.date >= ? AND t.date <= ?
      GROUP BY LOWER(label) ORDER BY total DESC LIMIT ?`,
    [from, to, limit],
  );
}
