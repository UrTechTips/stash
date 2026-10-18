import { evaluateGoal } from '../engine/buyOrWait';
import { earmarksFromHigherPriority } from '../engine/earmarks';
import type { Snapshot, Verdict } from '../engine/types';
import type { Goal } from '../db/types';
import type { MoneyContext } from './context';

export interface GoalWithVerdict {
  goal: Goal;
  verdict: Verdict;
}

/** The engine's verdict for one goal, given the current money picture. */
export function verdictFor(ctx: MoneyContext, goal: Goal, overrides: Partial<Snapshot> = {}): Verdict {
  const refs = ctx.goals.map((g) => ({ id: g.id, priority: g.priority, createdAt: g.createdAt, saved: g.saved }));
  const snapshot: Snapshot = {
    ...ctx.snapshot,
    otherEarmarks: earmarksFromHigherPriority(refs, goal.id),
    ...overrides,
  };
  return evaluateGoal(
    {
      price: goal.price,
      type: goal.type,
      createdAt: goal.createdAt,
      targetDate: goal.targetDate ?? undefined,
      savedAmount: goal.saved,
      expectedUses: goal.expectedUses ?? undefined,
    },
    snapshot,
    ctx.engine,
  );
}

/** Verdicts for every active goal, highest priority first. Higher-priority goals reserve their money before lower ones. */
export function evaluateAll(ctx: MoneyContext): GoalWithVerdict[] {
  return ctx.goals.map((goal) => ({ goal, verdict: verdictFor(ctx, goal) }));
}

/** "What if I save `extraMonthly` more each month?": the same goal with a better saving rate. */
export function whatIf(ctx: MoneyContext, goal: Goal, extraMonthly: number): Verdict {
  return verdictFor(ctx, goal, { monthlySavingRate: ctx.snapshot.monthlySavingRate + extraMonthly });
}

/** The goal the Home screen shows: the first one (by priority) that is closest to being buyable. */
export function topGoal(all: GoalWithVerdict[]): GoalWithVerdict | null {
  if (all.length === 0) return null;
  const rank = { buy_now: 0, almost_there: 1, keep_saving: 2, dont_buy: 3 } as const;
  return [...all].sort((a, b) => a.goal.priority - b.goal.priority || rank[a.verdict.status] - rank[b.verdict.status])[0];
}
