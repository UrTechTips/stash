import { formatMoney, type Minor } from '../lib/money';
import { addDays, daysBetween } from './dates';
import type {
  EngineSettings,
  GoalInput,
  Snapshot,
  Tier,
  Verdict,
  VerdictCheck,
  VerdictStatus,
} from './types';

const DAYS_PER_MONTH = 30;

/** Picks the tier from price as a share of monthly income. Unknown income falls back to the second tier. */
export function pickTier(price: Minor, monthlyIncome: Minor, tiers: Tier[]): Tier {
  if (monthlyIncome <= 0) return tiers[Math.min(1, tiers.length - 1)];
  const percent = (price / monthlyIncome) * 100;
  return tiers.find((t) => percent < t.maxPercent) ?? tiers[tiers.length - 1];
}

/**
 * The Buy-or-Wait engine (project doc, section 4). Pure: same input, same verdict.
 *
 *   B  buffer       = bufferMonths x essentials per month
 *   F  floor        = B + upcoming obligations O + other earmarks E
 *   R  required     = F + m x price
 *
 * Gates, in order of importance:
 *   1 safety      (hard)  L - P >= B + O          fail -> Don't buy
 *   2 comfort     (hard)  L >= R                  fail -> Keep saving
 *   3 cooling-off (hard)  days on wishlist >= C   fail -> Almost there
 *   4 budget      (soft)  uncovered part of P <= discretionary left; a warning only
 * Cost per use and work-hours are context, never a gate.
 */
export function evaluateGoal(goal: GoalInput, snap: Snapshot, settings: EngineSettings): Verdict {
  const money = (n: Minor) => formatMoney(n, { format: settings.currency });
  const P = goal.price;
  const L = snap.liquid;
  const O = snap.upcomingObligations;
  const E = snap.otherEarmarks;
  const B = Math.round(settings.bufferMonths * snap.essentialsMonthlyAvg);
  const F = B + O + E;

  // Item-type adjustments (section 4.4)
  const tier = pickTier(P, snap.monthlyIncomeAvg, settings.tiers);
  let m = tier.multiple;
  let C = tier.coolingOffDays;
  if (goal.type === 'need') {
    m = settings.needMultiple;
    C = 0;
  } else if (goal.type === 'gift' && goal.targetDate) {
    C = 0;
  }

  const R = F + m * P;
  const shortfall = Math.max(0, R - L);
  const waited = Math.max(0, daysBetween(goal.createdAt, snap.today));
  const waitDays = Math.max(0, C - waited);

  const safetyPassed = L - P >= B + O;
  const comfortPassed = L >= R;
  const coolingPassed = waited >= C;

  // When will money (and the waiting period) both be fine?
  const S = snap.monthlySavingRate;
  let moneyDays: number | undefined;
  if (shortfall === 0) moneyDays = 0;
  else if (S > 0) moneyDays = Math.max(1, Math.ceil((shortfall / S) * DAYS_PER_MONTH));
  const etaDate =
    moneyDays === undefined || (safetyPassed && comfortPassed && coolingPassed)
      ? undefined
      : addDays(snap.today, Math.max(moneyDays, waitDays));

  const checks: VerdictCheck[] = [];

  // 1 Safety
  checks.push(
    safetyPassed
      ? {
          id: 'safety',
          passed: true,
          severity: 'hard',
          message: `Safety: you would still keep ${money(L - P - (B + O))} above your buffer plus upcoming bills`,
        }
      : {
          id: 'safety',
          passed: false,
          severity: 'hard',
          message: `Safety: you would end ${money(B + O - (L - P))} below your buffer plus upcoming bills`,
        },
  );

  // 2 Comfort
  if (comfortPassed) {
    checks.push({
      id: 'comfort',
      passed: true,
      severity: 'hard',
      message: `Comfort: ${money(L)} available, ${money(R)} needed to keep a ${m}x cushion`,
    });
  } else {
    const when =
      moneyDays !== undefined
        ? ` · about ${moneyDays} ${moneyDays === 1 ? 'day' : 'days'} at your saving rate`
        : ' · your saving rate is zero or negative, so there is no date to estimate';
    checks.push({
      id: 'comfort',
      passed: false,
      severity: 'hard',
      message: `Comfort: you need ${money(shortfall)} more to keep a ${m}x cushion${when}`,
    });
  }

  // 3 Cooling-off
  checks.push(
    C === 0
      ? { id: 'cooling_off', passed: true, severity: 'hard', message: 'Cooling-off: not needed for this item' }
      : coolingPassed
        ? { id: 'cooling_off', passed: true, severity: 'hard', message: `Cooling-off: ${waited} of ${C} days done` }
        : {
            id: 'cooling_off',
            passed: false,
            severity: 'hard',
            message: `Cooling-off: ${waited} of ${C} days done, ${waitDays} more to go`,
          },
  );

  // 4 Budget (soft)
  const uncovered = Math.max(0, P - goal.savedAmount);
  const discretionary = Math.max(0, snap.discretionaryRemaining);
  if (uncovered === 0) {
    checks.push({ id: 'budget', passed: true, severity: 'soft', message: 'Budget: covered by what you set aside' });
  } else if (uncovered <= discretionary) {
    checks.push({
      id: 'budget',
      passed: true,
      severity: 'soft',
      message: `Budget: ${money(uncovered)} fits in the ${money(discretionary)} discretionary left this month`,
    });
  } else {
    checks.push({
      id: 'budget',
      passed: false,
      severity: 'soft',
      message: `Budget: ${money(uncovered)} vs ${money(discretionary)} discretionary left this month, over by ${money(uncovered - discretionary)}`,
    });
  }

  const status: VerdictStatus = !safetyPassed
    ? 'dont_buy'
    : !comfortPassed
      ? 'keep_saving'
      : !coolingPassed
        ? 'almost_there'
        : 'buy_now';

  // Suggested monthly contribution to hit a target date
  let suggestedMonthly: Minor | undefined;
  if (goal.targetDate && shortfall > 0) {
    const days = daysBetween(snap.today, goal.targetDate);
    suggestedMonthly = days <= 0 ? shortfall : Math.ceil(shortfall / Math.max(1, days / DAYS_PER_MONTH));
  }

  const costPerUse =
    goal.expectedUses && goal.expectedUses > 0 ? Math.round(P / goal.expectedUses) : undefined;
  const workHours =
    settings.hourlyEarnings && settings.hourlyEarnings > 0
      ? Math.round((P / settings.hourlyEarnings) * 10) / 10
      : undefined;

  return {
    status,
    shortfall,
    etaDate,
    waitDays,
    checks,
    tier: tier.name,
    multiple: m,
    coolingOffDays: C,
    buffer: B,
    floor: F,
    required: R,
    suggestedMonthly,
    costPerUse,
    workHours,
  };
}
