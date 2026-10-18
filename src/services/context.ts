import { dailyAllowance } from '../engine/allowance';
import { addDays, endOfMonth, monthOf, shiftMonth, startOfMonth, type ISODate } from '../engine/dates';
import type { AllowanceResult, EngineSettings, Snapshot } from '../engine/types';
import { listAccounts, summarizeAccounts } from '../db/accounts';
import { getBudget } from '../db/budgets';
import type { Db } from '../db/Db';
import { allocatedInMonth, listGoals } from '../db/goals';
import { listRules, occurrencesBetween, type Occurrence } from '../db/recurring';
import { loadSettings, toEngineSettings, type AppSettings } from '../db/settings';
import { listCategories } from '../db/categories';
import type { Account, BudgetView, Goal, Minor } from '../db/types';
import { budgetedSpend, monthlyTotals, spendByCategory, spendSplit } from './reports';

/** Everything the screens and the engine need to know about the user's money right now. */
export interface MoneyContext {
  today: ISODate;
  month: string;
  settings: AppSettings;
  engine: EngineSettings;
  accounts: Account[];
  liquid: Minor;
  netWorth: Minor;
  budget: BudgetView | null;
  /** Monthly budget plus any carry-over from last month. */
  budgetTotal: Minor;
  carryOver: Minor;
  allowance: AllowanceResult;
  /** Budgeted spending so far this month (including today). */
  spentThisMonth: Minor;
  upcomingBills: Occurrence[];
  /** The engine snapshot, with otherEarmarks still at 0 (it depends on which goal is being judged). */
  snapshot: Snapshot;
  goals: Goal[];
}

const round = Math.round;

export async function loadContext(db: Db, today: ISODate): Promise<MoneyContext> {
  const settings = await loadSettings(db);
  const engine = toEngineSettings(settings);
  const accounts = await listAccounts(db);
  const { netWorth, liquid } = summarizeAccounts(accounts);
  const month = monthOf(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // ---- history-based averages (the 3 months before this one), with fallbacks for new users
  const histFrom = `${shiftMonth(month, -3)}-01`;
  const histTo = endOfMonth(`${shiftMonth(month, -1)}-01`);
  const history = (await monthlyTotals(db, histFrom, histTo)).filter((t) => t.income > 0 || t.expense > 0);
  const avg = (pick: (t: (typeof history)[number]) => number) =>
    history.length ? round(history.reduce((s, t) => s + pick(t), 0) / history.length) : 0;
  const essentialsMonthlyAvg = avg((t) => t.essential) || settings.essentialsEstimate;
  const monthlyIncomeAvg = avg((t) => t.income) || settings.incomeEstimate;
  const monthlySavingRate = history.length ? avg((t) => t.income - t.expense) : settings.savingRateEstimate;

  // ---- this month's budget
  const budget = await getBudget(db, month);
  let carryOver = 0;
  if (budget?.carryOver) {
    const prevMonth = shiftMonth(month, -1);
    const prev = await getBudget(db, prevMonth);
    if (prev) {
      const prevSpent = await budgetedSpend(db, `${prevMonth}-01`, endOfMonth(`${prevMonth}-01`));
      carryOver = Math.max(0, prev.total - prevSpent);
    }
  }
  const budgetTotal = (budget?.total ?? 0) + carryOver;

  // ---- bills and goals
  const rules = await listRules(db, { activeOnly: true });
  const futureBills = occurrencesBetween(rules, today, monthEnd).filter((o) => o.rule.type === 'expense' && o.date > today);
  const unpaidFixedBills = futureBills.reduce((s, o) => s + o.rule.amount, 0);

  const goals = await listGoals(db, 'active');
  const allocated = await allocatedInMonth(db, month);
  const plannedGoalContributions = goals.reduce((s, g) => s + Math.max(0, g.monthlyPlan - (allocated[g.id] ?? 0)), 0);

  // bills already paid this month, needed by strict mode
  const paidBills = await db.first<{ n: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS n FROM transactions
      WHERE type = 'expense' AND recurring_id IS NOT NULL AND date >= ? AND date <= ?`,
    [monthStart, today],
  );

  const split = await spendSplit(db, monthStart, today);
  const allowance = dailyAllowance({
    today,
    mode: settings.allowanceMode,
    budgetTotal,
    spentBeforeToday: split.before,
    spentToday: split.today,
    unpaidFixedBills,
    plannedGoalContributions,
    fixedBillsThisMonth: unpaidFixedBills + (paidBills?.n ?? 0),
  });

  // ---- discretionary money left (feeds the budget gate)
  let discretionaryRemaining = budget ? allowance.monthRemaining : 0;
  if (budget) {
    const categories = await listCategories(db, { kind: 'discretionary', includeArchived: true });
    const limitIds = categories.filter((c) => budget.limits[c.id] > 0);
    if (limitIds.length > 0) {
      const spent = await spendByCategory(db, monthStart, today, { budgetedOnly: true });
      const limitTotal = limitIds.reduce((s, c) => s + budget.limits[c.id], 0);
      const spentOnThose = spent.filter((s) => limitIds.some((c) => c.id === s.categoryId)).reduce((s, x) => s + x.total, 0);
      discretionaryRemaining = limitTotal - spentOnThose;
    }
  }

  // ---- obligations: bills due before the next paycheck
  const incomeDates = occurrencesBetween(rules, today, addDays(today, 62))
    .filter((o) => o.rule.type === 'income' && o.date > today)
    .map((o) => o.date);
  const nextIncome = incomeDates[0] ?? monthEnd;
  const upcomingObligations = occurrencesBetween(rules, today, nextIncome)
    .filter((o) => o.rule.type === 'expense' && o.date > today && o.date < nextIncome)
    .reduce((s, o) => s + o.rule.amount, 0);

  const upcomingBills = occurrencesBetween(rules, today, addDays(today, 14)).filter(
    (o) => o.rule.type === 'expense' && o.date > today,
  );

  const spentThisMonth = split.before + split.today;

  return {
    today,
    month,
    settings,
    engine,
    accounts,
    liquid,
    netWorth,
    budget,
    budgetTotal,
    carryOver,
    allowance,
    spentThisMonth,
    upcomingBills,
    snapshot: {
      today,
      liquid,
      essentialsMonthlyAvg,
      monthlyIncomeAvg,
      upcomingObligations,
      otherEarmarks: 0,
      monthlySavingRate,
      discretionaryRemaining,
    },
    goals,
  };
}
