import type { ISODate } from './dates';
import type { Minor } from './types';

/** The minimum a goal needs to take part in priority ordering. */
export interface GoalRef {
  id: number;
  /** 1 is the highest priority. */
  priority: number;
  createdAt: ISODate;
  saved: Minor;
}

const byPriority = (a: GoalRef, b: GoalRef) =>
  a.priority - b.priority || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || a.id - b.id;

/**
 * Money already set aside for goals that rank above this one. The Buy-or-Wait engine
 * treats it as untouchable, so the higher-priority goal reserves its money first.
 */
export function earmarksFromHigherPriority(goals: GoalRef[], goalId: number): Minor {
  const sorted = [...goals].sort(byPriority);
  let total = 0;
  for (const g of sorted) {
    if (g.id === goalId) return total;
    total += Math.max(0, g.saved);
  }
  return total;
}

export type AllocationCheck = { ok: true } | { ok: false; message: string; maxAllowed: Minor };

/**
 * An account can never have more money earmarked than it holds.
 * `earmarkedNow` is what active goals already hold on this account; `amount` is the change
 * (negative when releasing money back).
 */
export function validateAllocation(accountBalance: Minor, earmarkedNow: Minor, amount: Minor): AllocationCheck {
  if (!Number.isInteger(amount) || amount === 0) {
    return { ok: false, message: 'Enter an amount greater than zero.', maxAllowed: 0 };
  }
  const maxAllowed = Math.max(0, accountBalance - earmarkedNow);
  if (amount > 0 && amount > maxAllowed) {
    return {
      ok: false,
      message: 'That is more than the free money in this account.',
      maxAllowed,
    };
  }
  return { ok: true };
}
