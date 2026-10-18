import { describe, expect, it } from 'vitest';
import { dailyAllowance } from './allowance';
import type { AllowanceInput } from './types';

const rupees = (n: number) => n * 100;
const input = (over: Partial<AllowanceInput> = {}): AllowanceInput => ({
  today: '2026-10-01',
  mode: 'rolling',
  budgetTotal: rupees(31_000),
  spentBeforeToday: 0,
  spentToday: 0,
  unpaidFixedBills: 0,
  plannedGoalContributions: 0,
  ...over,
});

describe('dailyAllowance (October has 31 days)', () => {
  it('month start: budget / 31', () => {
    const r = dailyAllowance(input());
    expect(r.allowance).toBe(rupees(1_000));
    expect(r.daysLeft).toBe(31);
    expect(r.remainingToday).toBe(rupees(1_000));
    expect(r.overBudgetBy).toBe(0);
  });

  it('subtracts unpaid fixed bills and planned goal contributions', () => {
    const r = dailyAllowance(input({ unpaidFixedBills: rupees(6_000), plannedGoalContributions: rupees(3_000) }));
    expect(r.allowance).toBe(Math.floor(rupees(22_000) / 31)); // (31,000 - 9,000) / 31 = 709.67, rounded down in paise
  });

  it('mid-month: remaining budget over remaining days, today included', () => {
    const r = dailyAllowance(input({ today: '2026-10-16', spentBeforeToday: rupees(15_000) }));
    expect(r.daysLeft).toBe(16);
    expect(r.allowance).toBe(rupees(1_000)); // 16,000 / 16
    expect(r.paceFraction).toBeCloseTo(16 / 31);
  });

  it('rolling mode: underspending today raises tomorrow, overspending lowers it', () => {
    const day1 = dailyAllowance(input({ spentToday: rupees(400) }));
    expect(day1.remainingToday).toBe(rupees(600));
    const tomorrow = dailyAllowance(input({ today: '2026-10-02', spentBeforeToday: rupees(400) }));
    expect(tomorrow.allowance).toBeGreaterThan(rupees(1_000));

    const over = dailyAllowance(input({ spentToday: rupees(1_600) }));
    expect(over.remainingToday).toBe(-rupees(600));
    expect(over.overToday).toBe(rupees(600));
    const tomorrow2 = dailyAllowance(input({ today: '2026-10-02', spentBeforeToday: rupees(1_600) }));
    expect(tomorrow2.allowance).toBeLessThan(rupees(1_000));
  });

  it('last day: everything left is today', () => {
    const r = dailyAllowance(input({ today: '2026-10-31', spentBeforeToday: rupees(30_000) }));
    expect(r.daysLeft).toBe(1);
    expect(r.allowance).toBe(rupees(1_000));
  });

  it('over budget: shows how far over and a daily number of zero, never a negative', () => {
    const r = dailyAllowance(input({ today: '2026-10-20', spentBeforeToday: rupees(31_500) }));
    expect(r.overBudgetBy).toBe(rupees(500));
    expect(r.allowance).toBe(0);
    expect(r.remainingToday).toBe(0);
    // spending today can also tip it over
    const tipped = dailyAllowance(input({ today: '2026-10-20', spentBeforeToday: rupees(30_000), spentToday: rupees(2_000) }));
    expect(tipped.overBudgetBy).toBe(rupees(1_000));
    expect(tipped.remainingToday).toBe(0);
  });

  it('strict mode: a fixed amount per day, no carry-over', () => {
    const early = dailyAllowance(input({ mode: 'strict', fixedBillsThisMonth: rupees(3_100) }));
    const late = dailyAllowance(input({ mode: 'strict', today: '2026-10-25', fixedBillsThisMonth: rupees(3_100), spentBeforeToday: rupees(5_000), unpaidFixedBills: 0 }));
    expect(early.allowance).toBe(rupees(900)); // (31,000 - 3,100) / 31
    expect(late.allowance).toBe(early.allowance);
  });

  it('works in February of a leap year', () => {
    const r = dailyAllowance(input({ today: '2028-02-29', budgetTotal: rupees(29_000), spentBeforeToday: rupees(28_000) }));
    expect(r.daysInMonth).toBe(29);
    expect(r.daysLeft).toBe(1);
    expect(r.allowance).toBe(rupees(1_000));
  });
});
