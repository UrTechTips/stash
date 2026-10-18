import { addDays, type ISODate } from '../engine/dates';
import { formatMoney } from '../lib/money';
import type { MoneyContext } from './context';
import { evaluateAll } from './goals';
import { listRules, occurrencesBetween } from '../db/recurring';
import type { Db } from '../db/Db';

export interface PlannedReminder {
  /** Stable id, so re-planning replaces instead of duplicating. */
  id: string;
  /** The day to fire, at 9 in the morning local time. */
  date: ISODate;
  title: string;
  body: string;
}

/**
 * Decides which local notifications should exist, as plain data (the phone-side code only has to
 * schedule them): a heads-up the day before each bill, and a nudge on the day a goal should
 * become safe to buy.
 */
export async function planReminders(db: Db, ctx: MoneyContext, opts: { bills: boolean; goals: boolean }): Promise<PlannedReminder[]> {
  const today = ctx.today;
  const out: PlannedReminder[] = [];
  const fmt = (n: number) => formatMoney(n, { format: ctx.engine.currency });

  if (opts.bills) {
    const rules = await listRules(db, { activeOnly: true });
    for (const o of occurrencesBetween(rules, today, addDays(today, 30))) {
      if (o.rule.type !== 'expense') continue;
      const remindOn = addDays(o.date, -1) > today ? addDays(o.date, -1) : o.date;
      if (remindOn <= today) continue;
      const name = o.rule.note || 'A bill';
      out.push({
        id: `bill-${o.rule.id}-${o.date}`,
        date: remindOn,
        title: `${name} is due ${remindOn === o.date ? 'today' : 'tomorrow'}`,
        body: `${fmt(o.rule.amount)} will be taken from your budget.`,
      });
    }
  }

  if (opts.goals) {
    for (const { goal, verdict } of evaluateAll(ctx)) {
      if (verdict.status === 'buy_now' || !verdict.etaDate || verdict.etaDate <= today) continue;
      if (verdict.etaDate > addDays(today, 120)) continue;
      out.push({
        id: `goal-${goal.id}-${verdict.etaDate}`,
        date: verdict.etaDate,
        title: `${goal.name} should be safe to buy`,
        body: 'Open Stash to double-check the verdict.',
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
