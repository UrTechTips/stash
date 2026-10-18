import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dailyAllowance } from './allowance';
import { evaluateGoal } from './buyOrWait';
import { DEFAULT_ENGINE_SETTINGS } from './defaults';
import { earmarksFromHigherPriority } from './earmarks';
import type { AllowanceInput, GoalInput, Snapshot } from './types';

const money = fc.integer({ min: 0, max: 5_000_000_00 });
const signedMoney = fc.integer({ min: -2_000_000_00, max: 5_000_000_00 });
const day = fc.integer({ min: 0, max: 60 }).map((n) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10));

const snapshot = fc.record<Snapshot>({
  today: fc.constant('2026-10-14'),
  liquid: signedMoney,
  essentialsMonthlyAvg: money,
  monthlyIncomeAvg: money,
  upcomingObligations: money,
  otherEarmarks: money,
  monthlySavingRate: signedMoney,
  discretionaryRemaining: signedMoney,
});

const goalInput = fc.record<GoalInput>({
  price: fc.integer({ min: 1, max: 2_000_000_00 }),
  type: fc.constantFrom('want', 'need', 'gift'),
  createdAt: day,
  targetDate: fc.option(day, { nil: undefined }),
  savedAmount: money,
  expectedUses: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
});

describe('engine invariants (property tests)', () => {
  it('shortfall is never negative', () => {
    fc.assert(
      fc.property(goalInput, snapshot, (g, s) => {
        expect(evaluateGoal(g, s, DEFAULT_ENGINE_SETTINGS).shortfall).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('buy_now is never returned when the safety gate fails', () => {
    fc.assert(
      fc.property(goalInput, snapshot, (g, s) => {
        const v = evaluateGoal(g, s, DEFAULT_ENGINE_SETTINGS);
        const safety = v.checks.find((c) => c.id === 'safety')!;
        if (!safety.passed) expect(v.status).toBe('dont_buy');
        if (v.status === 'buy_now') {
          expect(safety.passed).toBe(true);
          expect(v.shortfall).toBe(0);
          expect(v.waitDays).toBe(0);
        }
      }),
    );
  });

  it('every verdict explains itself with the four checks, in order', () => {
    fc.assert(
      fc.property(goalInput, snapshot, (g, s) => {
        const v = evaluateGoal(g, s, DEFAULT_ENGINE_SETTINGS);
        expect(v.checks.map((c) => c.id)).toEqual(['safety', 'comfort', 'cooling_off', 'budget']);
        expect(v.checks.every((c) => c.message.length > 0)).toBe(true);
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(goalInput, snapshot, (g, s) => {
        expect(evaluateGoal(g, s, DEFAULT_ENGINE_SETTINGS)).toEqual(evaluateGoal(g, s, DEFAULT_ENGINE_SETTINGS));
      }),
    );
  });

  it('has no ETA without a positive saving rate', () => {
    fc.assert(
      fc.property(goalInput, snapshot, (g, s) => {
        const v = evaluateGoal(g, { ...s, monthlySavingRate: Math.min(0, s.monthlySavingRate) }, DEFAULT_ENGINE_SETTINGS);
        if (v.shortfall > 0) expect(v.etaDate).toBeUndefined();
      }),
    );
  });

  it('the allowance is never NaN or negative, whatever the inputs', () => {
    const allowanceInput = fc.record<AllowanceInput>({
      today: day,
      mode: fc.constantFrom('rolling', 'strict'),
      budgetTotal: money,
      spentBeforeToday: money,
      spentToday: money,
      unpaidFixedBills: money,
      plannedGoalContributions: money,
      fixedBillsThisMonth: fc.option(money, { nil: undefined }),
    });
    fc.assert(
      fc.property(allowanceInput, (i) => {
        const r = dailyAllowance(i);
        for (const n of [r.allowance, r.remainingToday, r.monthRemaining, r.overBudgetBy, r.paceFraction]) {
          expect(Number.isFinite(n)).toBe(true);
        }
        expect(r.allowance).toBeGreaterThanOrEqual(0);
        expect(r.overBudgetBy).toBeGreaterThanOrEqual(0);
        if (r.overBudgetBy > 0) expect(r.allowance).toBe(0);
      }),
    );
  });

  it('earmark totals do not depend on the order the goals are listed in', () => {
    const goalRef = fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      priority: fc.integer({ min: 1, max: 3 }),
      createdAt: day,
      saved: money,
    });
    fc.assert(
      fc.property(fc.uniqueArray(goalRef, { selector: (g) => g.id, minLength: 1, maxLength: 8 }), (goals) => {
        const target = goals[0].id;
        const forward = earmarksFromHigherPriority(goals, target);
        const reversed = earmarksFromHigherPriority([...goals].reverse(), target);
        expect(forward).toBe(reversed);
      }),
    );
  });
});
