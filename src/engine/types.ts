import type { CurrencyFormat, Minor } from '../lib/money';
import type { ISODate } from './dates';

export type { Minor };

/** Plain-data picture of the user's money. The app layer builds it; the engine only reads it. */
export interface Snapshot {
  today: ISODate;
  /** Sum of spendable accounts. */
  liquid: Minor;
  /** Average monthly spending in Essential categories (last 3 months). */
  essentialsMonthlyAvg: Minor;
  monthlyIncomeAvg: Minor;
  /** Unpaid bills before the next income. */
  upcomingObligations: Minor;
  /** Money reserved for other, higher-priority goals. */
  otherEarmarks: Minor;
  /** 3-month average of net savings; may be zero or negative. */
  monthlySavingRate: Minor;
  /** Discretionary budget left this month (may be negative). */
  discretionaryRemaining: Minor;
}

export type GoalType = 'want' | 'need' | 'gift';

export interface GoalInput {
  price: Minor;
  type: GoalType;
  createdAt: ISODate;
  targetDate?: ISODate;
  savedAmount: Minor;
  /** Optional: how many times you expect to use it, for cost per use. */
  expectedUses?: number;
}

export type TierName = 'small' | 'medium' | 'large' | 'major';

/** A price tier. `maxPercent` is the exclusive upper bound of price as a % of monthly income. */
export interface Tier {
  name: TierName;
  maxPercent: number;
  multiple: number;
  coolingOffDays: number;
}

export interface EngineSettings {
  currency: CurrencyFormat;
  /** Months of essential spending to keep untouched (1 to 3). */
  bufferMonths: number;
  /** Ordered small to major; the last tier should have maxPercent = Infinity. */
  tiers: Tier[];
  /** Multiple used for Need-type items. */
  needMultiple: number;
  /** Optional hourly earnings (minor units) for the work-hours figure. */
  hourlyEarnings?: Minor;
}

export type VerdictStatus = 'buy_now' | 'almost_there' | 'keep_saving' | 'dont_buy';

export interface VerdictCheck {
  id: 'safety' | 'comfort' | 'cooling_off' | 'budget';
  passed: boolean;
  /** hard = blocks the verdict; soft = a warning only. */
  severity: 'hard' | 'soft';
  message: string;
}

export interface Verdict {
  status: VerdictStatus;
  /** max(0, floor + m * price - liquid) */
  shortfall: Minor;
  /** When the goal should be safe to buy. Absent when the saving rate is zero or negative. */
  etaDate?: ISODate;
  /** Cooling-off days still to go. */
  waitDays: number;
  checks: VerdictCheck[];

  // Numbers behind the verdict, handy for the detail screen.
  tier: TierName;
  multiple: number;
  coolingOffDays: number;
  buffer: Minor;
  /** Floor F = buffer + obligations + other earmarks. */
  floor: Minor;
  /** Required funds R = F + m * price. */
  required: Minor;
  /** When a target date is set: what to put aside each month to get there. */
  suggestedMonthly?: Minor;
  /** Context only, never a gate. */
  costPerUse?: Minor;
  workHours?: number;
}

export type AllowanceMode = 'rolling' | 'strict';

export interface AllowanceInput {
  today: ISODate;
  mode: AllowanceMode;
  /** Monthly budget including any carry-over. */
  budgetTotal: Minor;
  /** Budgeted spending so far this month, not counting today's own spending. */
  spentBeforeToday: Minor;
  spentToday: Minor;
  /** Fixed bills still to come this month. */
  unpaidFixedBills: Minor;
  /** Money you planned to set aside for goals this month and have not yet. */
  plannedGoalContributions: Minor;
  /** Strict mode only: all fixed bills this month, paid or not. Defaults to unpaidFixedBills. */
  fixedBillsThisMonth?: Minor;
}

export interface AllowanceResult {
  /** Safe to spend per day. */
  allowance: Minor;
  /** Allowance minus today's spending; can be negative when you overspend today. */
  remainingToday: Minor;
  /** How far today's spending went past the allowance (0 when it did not). */
  overToday: Minor;
  daysLeft: number;
  daysInMonth: number;
  monthRemaining: Minor;
  /** Greater than 0 when the monthly budget is already used up. */
  overBudgetBy: Minor;
  /** How far through the month you are, 0..1. */
  paceFraction: number;
}
