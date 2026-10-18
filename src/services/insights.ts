import { addDays, endOfMonth, shiftMonth, startOfMonth, type ISODate } from '../engine/dates';
import type { Db } from '../db/Db';
import type { Minor } from '../db/types';
import { monthlyTotals, spendByCategory, topPlaces, type CategorySpend, type MonthTotals } from './reports';

export interface Insights {
  /** Last 6 months including this one, oldest first, with zeroes for empty months. */
  months: { month: string; income: Minor; expense: Minor; saved: Minor }[];
  thisMonth: CategorySpend[];
  lastMonth: CategorySpend[];
  /** Average of (income - spending) / income over past months that had income, 0..1; null if unknown. */
  avgSavingRate: number | null;
  /** Average net savings per past month with data. */
  avgSaved: Minor | null;
  /** Where discretionary money went over the last 90 days. */
  topPlaces: { label: string; total: Minor }[];
}

export async function loadInsights(db: Db, today: ISODate): Promise<Insights> {
  const month = today.slice(0, 7);
  const first = shiftMonth(month, -5);
  const totals = await monthlyTotals(db, `${first}-01`, endOfMonth(today));
  const byMonth = new Map<string, MonthTotals>(totals.map((t) => [t.month, t]));

  const months = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(first, i);
    const t = byMonth.get(m);
    return { month: m, income: t?.income ?? 0, expense: t?.expense ?? 0, saved: (t?.income ?? 0) - (t?.expense ?? 0) };
  });

  // Past months only: this month is still in progress and would skew the average.
  const past = months.filter((m) => m.month < month && (m.income > 0 || m.expense > 0));
  const withIncome = past.filter((m) => m.income > 0);
  const avgSavingRate = withIncome.length
    ? withIncome.reduce((s, m) => s + (m.income - m.expense) / m.income, 0) / withIncome.length
    : null;
  const avgSaved = past.length ? Math.round(past.reduce((s, m) => s + m.saved, 0) / past.length) : null;

  const prev = shiftMonth(month, -1);
  const [thisMonth, lastMonth, places] = await Promise.all([
    spendByCategory(db, startOfMonth(today), today),
    spendByCategory(db, `${prev}-01`, endOfMonth(`${prev}-01`)),
    topPlaces(db, addDays(today, -90), today, 3),
  ]);
  return { months, thisMonth, lastMonth, avgSavingRate, avgSaved, topPlaces: places };
}
