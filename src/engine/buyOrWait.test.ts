import { describe, expect, it } from 'vitest';
import { addDays, DEFAULT_ENGINE_SETTINGS, earmarksFromHigherPriority, evaluateGoal, pickTier, validateAllocation } from './index';
import type { EngineSettings, GoalInput, Snapshot } from './types';

const TODAY = '2026-10-14';
const rupees = (n: number) => n * 100;

/** The keyboard example from the project doc, section 4.7. */
const base: Snapshot = {
  today: TODAY,
  liquid: rupees(14_500),
  essentialsMonthlyAvg: rupees(10_000),
  monthlyIncomeAvg: rupees(25_000),
  upcomingObligations: rupees(2_000),
  otherEarmarks: 0,
  monthlySavingRate: rupees(4_000),
  discretionaryRemaining: rupees(1_800),
};
const keyboard: GoalInput = {
  price: rupees(3_000),
  type: 'want',
  createdAt: addDays(TODAY, -9),
  savedAmount: rupees(3_000),
};
const settings: EngineSettings = DEFAULT_ENGINE_SETTINGS;
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ ...base, ...over });
const goal = (over: Partial<GoalInput> = {}): GoalInput => ({ ...keyboard, ...over });
const check = (v: ReturnType<typeof evaluateGoal>, id: string) => v.checks.find((c) => c.id === id)!;

describe('evaluateGoal: the keyboard example', () => {
  const v = evaluateGoal(keyboard, base, settings);

  it("is Don't buy even though the goal is fully funded", () => {
    expect(v.status).toBe('dont_buy');
  });

  it('does the arithmetic from the doc', () => {
    expect(v.tier).toBe('medium');
    expect(v.multiple).toBe(2);
    expect(v.buffer).toBe(rupees(10_000));
    expect(v.floor).toBe(rupees(12_000));
    expect(v.required).toBe(rupees(18_000));
    expect(v.shortfall).toBe(rupees(3_500));
  });

  it('explains the safety failure with the exact amount', () => {
    const safety = check(v, 'safety');
    expect(safety.passed).toBe(false);
    expect(safety.message).toBe('Safety: you would end ₹500 below your buffer plus upcoming bills');
  });

  it('shows the cooling-off check as passed (9 of 7 days)', () => {
    expect(check(v, 'cooling_off').message).toBe('Cooling-off: 9 of 7 days done');
  });

  it('estimates about 27 days at 4,000 a month (3,500 / 4,000 of a month, rounded up)', () => {
    expect(v.etaDate).toBe(addDays(TODAY, 27));
  });

  it('flips to Buy now once liquid money reaches 18,000', () => {
    expect(evaluateGoal(keyboard, snap({ liquid: rupees(18_000) }), settings).status).toBe('buy_now');
    expect(evaluateGoal(keyboard, snap({ liquid: rupees(17_999) }), settings).status).toBe('keep_saving');
  });
});

describe('evaluateGoal: scenario table (project doc, section 14)', () => {
  it('plenty of liquid money, cooling-off done -> Buy now', () => {
    const v = evaluateGoal(goal(), snap({ liquid: rupees(40_000) }), settings);
    expect(v.status).toBe('buy_now');
    expect(v.shortfall).toBe(0);
    expect(v.etaDate).toBeUndefined();
    expect(v.checks.every((c) => c.passed)).toBe(true);
  });

  it('safety passes but below F + m x P -> Keep saving with the right shortfall and ETA', () => {
    const v = evaluateGoal(goal(), snap({ liquid: rupees(16_000) }), settings);
    expect(v.status).toBe('keep_saving');
    expect(check(v, 'safety').passed).toBe(true);
    expect(v.shortfall).toBe(rupees(2_000));
    expect(v.etaDate).toBe(addDays(TODAY, 15)); // 2,000 / 4,000 of a month = 15 days
  });

  it('money fine but the wishlist is too young -> Almost there', () => {
    const v = evaluateGoal(goal({ createdAt: addDays(TODAY, -3) }), snap({ liquid: rupees(40_000) }), settings);
    expect(v.status).toBe('almost_there');
    expect(v.waitDays).toBe(4);
    expect(v.etaDate).toBe(addDays(TODAY, 4));
    expect(check(v, 'cooling_off').message).toBe('Cooling-off: 3 of 7 days done, 4 more to go');
  });

  it('zero or negative saving rate -> Keep saving, no ETA, and says so plainly', () => {
    for (const rate of [0, -rupees(500)]) {
      const v = evaluateGoal(goal(), snap({ liquid: rupees(16_000), monthlySavingRate: rate }), settings);
      expect(v.status).toBe('keep_saving');
      expect(v.etaDate).toBeUndefined();
      expect(check(v, 'comfort').message).toContain('saving rate is zero or negative');
    }
  });

  it('need-type item uses m = 1 and no cooling-off -> Buy now once safety passes', () => {
    const need = goal({ type: 'need', createdAt: TODAY });
    const v = evaluateGoal(need, snap({ liquid: rupees(15_500) }), settings);
    expect(v.multiple).toBe(1);
    expect(v.coolingOffDays).toBe(0);
    expect(v.status).toBe('buy_now');
    // ...but safety still applies
    expect(evaluateGoal(need, snap({ liquid: rupees(14_500) }), settings).status).toBe('dont_buy');
  });

  it('gift with a fixed date ignores cooling-off but keeps the safety checks', () => {
    const gift = goal({ type: 'gift', createdAt: TODAY, targetDate: addDays(TODAY, 20) });
    expect(evaluateGoal(gift, snap({ liquid: rupees(40_000) }), settings).status).toBe('buy_now');
    expect(evaluateGoal(gift, snap({ liquid: rupees(13_000) }), settings).status).toBe('dont_buy');
    // a gift without a date is treated like any want
    expect(evaluateGoal({ ...gift, targetDate: undefined }, snap({ liquid: rupees(40_000) }), settings).status).toBe('almost_there');
  });

  it('two goals competing for the same money: the higher priority reserves first', () => {
    const goals = [
      { id: 1, priority: 2, createdAt: '2026-09-01', saved: rupees(6_000) },
      { id: 2, priority: 1, createdAt: '2026-09-20', saved: rupees(6_000) },
    ];
    expect(earmarksFromHigherPriority(goals, 2)).toBe(0);
    expect(earmarksFromHigherPriority(goals, 1)).toBe(rupees(6_000));

    const s = snap({ liquid: rupees(22_000) });
    const high = evaluateGoal(goal({ price: rupees(3_000) }), { ...s, otherEarmarks: 0 }, settings);
    const low = evaluateGoal(goal({ price: rupees(3_000) }), { ...s, otherEarmarks: rupees(6_000) }, settings);
    expect(high.status).toBe('buy_now');
    expect(low.status).toBe('keep_saving');
  });

  it('priority ties go to the older goal, then the lower id', () => {
    const goals = [
      { id: 5, priority: 1, createdAt: '2026-09-02', saved: 100 },
      { id: 4, priority: 1, createdAt: '2026-09-01', saved: 200 },
    ];
    expect(earmarksFromHigherPriority(goals, 5)).toBe(200);
    expect(earmarksFromHigherPriority(goals, 4)).toBe(0);
  });

  it('account earmarks above the balance are a validation error', () => {
    expect(validateAllocation(rupees(5_000), rupees(4_000), rupees(1_000)).ok).toBe(true);
    const bad = validateAllocation(rupees(5_000), rupees(4_000), rupees(1_001));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.maxAllowed).toBe(rupees(1_000));
    expect(validateAllocation(rupees(5_000), rupees(4_000), -rupees(500)).ok).toBe(true); // releasing is fine
    expect(validateAllocation(rupees(5_000), 0, 0).ok).toBe(false);
  });
});

describe('evaluateGoal: details', () => {
  it('picks tiers from price as a share of monthly income', () => {
    const t = settings.tiers;
    const income = rupees(100_000);
    expect(pickTier(rupees(2_999), income, t).name).toBe('small');
    expect(pickTier(rupees(3_000), income, t).name).toBe('medium');
    expect(pickTier(rupees(14_999), income, t).name).toBe('medium');
    expect(pickTier(rupees(15_000), income, t).name).toBe('large');
    expect(pickTier(rupees(40_000), income, t).name).toBe('major');
    expect(pickTier(rupees(5_000), 0, t).name).toBe('medium'); // unknown income
  });

  it('budget gate is soft: it warns but never changes the verdict', () => {
    const unfunded = goal({ savedAmount: 0 });
    const v = evaluateGoal(unfunded, snap({ liquid: rupees(40_000), discretionaryRemaining: rupees(1_800) }), settings);
    expect(v.status).toBe('buy_now');
    const budget = check(v, 'budget');
    expect(budget.passed).toBe(false);
    expect(budget.severity).toBe('soft');
    expect(budget.message).toBe('Budget: ₹3,000 vs ₹1,800 discretionary left this month, over by ₹1,200');
  });

  it('budget gate passes when the goal is covered by savings', () => {
    const v = evaluateGoal(goal(), snap({ discretionaryRemaining: 0 }), settings);
    expect(check(v, 'budget').passed).toBe(true);
  });

  it('suggests a monthly contribution when there is a target date', () => {
    const v = evaluateGoal(
      goal({ targetDate: addDays(TODAY, 60) }),
      snap({ liquid: rupees(14_500) }),
      settings,
    );
    expect(v.shortfall).toBe(rupees(3_500));
    expect(v.suggestedMonthly).toBe(rupees(1_750)); // 3,500 over two months
    const late = evaluateGoal(goal({ targetDate: addDays(TODAY, -1) }), snap(), settings);
    expect(late.suggestedMonthly).toBe(rupees(3_500));
  });

  it('shows cost per use and work-hours as context only', () => {
    const v = evaluateGoal(
      goal({ expectedUses: 300 }),
      snap({ liquid: rupees(40_000) }),
      { ...settings, hourlyEarnings: rupees(250) },
    );
    expect(v.costPerUse).toBe(rupees(10));
    expect(v.workHours).toBe(12);
    expect(v.status).toBe('buy_now');
  });

  it('changing the buffer setting changes the verdict immediately', () => {
    const s = snap({ liquid: rupees(18_000) });
    expect(evaluateGoal(keyboard, s, settings).status).toBe('buy_now');
    expect(evaluateGoal(keyboard, s, { ...settings, bufferMonths: 2 }).status).toBe('dont_buy');
  });

  it('formats messages with the configured currency', () => {
    const v = evaluateGoal(keyboard, base, {
      ...settings,
      currency: { symbol: '$', indianGrouping: false, minorDigits: 2 },
    });
    expect(check(v, 'safety').message).toContain('$500');
  });
});
