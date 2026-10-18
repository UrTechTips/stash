import { daysInMonth, parseISO } from './dates';
import type { AllowanceInput, AllowanceResult } from './types';

/**
 * Daily spending allowance (project doc, section 5).
 *
 *   safe per day = (budget remaining - unpaid fixed bills - planned goal contributions)
 *                  / days left in the month (including today)
 *
 * Rolling mode recalculates from scratch every day, so underspending today raises
 * tomorrow's number and overspending lowers it; there is no drifting state.
 * Strict mode gives every day the same fixed amount with no carry-over.
 * When the month's budget is used up the day's number is 0 and `overBudgetBy` says by how much,
 * instead of showing a confusing negative.
 */
export function dailyAllowance(input: AllowanceInput): AllowanceResult {
  const { y, m, d } = parseISO(input.today);
  const monthDays = daysInMonth(y, m);
  const daysLeft = monthDays - d + 1;

  const pool =
    input.budgetTotal - input.spentBeforeToday - input.unpaidFixedBills - input.plannedGoalContributions;
  const monthRemaining = pool - input.spentToday;

  let allowance: number;
  if (input.mode === 'strict') {
    const fixed = input.fixedBillsThisMonth ?? input.unpaidFixedBills;
    allowance = Math.floor(
      Math.max(0, input.budgetTotal - fixed - input.plannedGoalContributions) / monthDays,
    );
  } else {
    allowance = Math.floor(Math.max(0, pool) / daysLeft);
  }

  const overBudgetBy = monthRemaining < 0 ? -monthRemaining : 0;
  if (overBudgetBy > 0) allowance = 0;

  const remainingToday = overBudgetBy > 0 ? 0 : allowance - input.spentToday;
  return {
    allowance,
    remainingToday,
    overToday: overBudgetBy > 0 ? 0 : Math.max(0, -remainingToday),
    daysLeft,
    daysInMonth: monthDays,
    monthRemaining,
    overBudgetBy,
    paceFraction: d / monthDays,
  };
}
