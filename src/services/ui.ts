import { shortDate } from '../engine/dates';
import type { Verdict, VerdictCheck as EngineCheck } from '../engine/types';
import { formatMoney } from '../lib/money';
import type { VerdictCheck as UiCheck } from '../components/Verdict';

/** Engine checks -> the icon-and-message lines the goal card draws. A failed soft check is a warning, not a stop sign. */
export function checksToUi(checks: EngineCheck[]): UiCheck[] {
  return checks.map((c) => ({
    state: c.passed ? 'pass' : c.severity === 'soft' ? 'warn' : 'fail',
    message: c.message,
  }));
}

/** The one-line takeaway under a goal's name. */
export function headlineFor(v: Verdict, today: string): string {
  switch (v.status) {
    case 'buy_now':
      return 'Safe to buy now';
    case 'almost_there':
      return `Money is fine. Wait ${v.waitDays} more ${v.waitDays === 1 ? 'day' : 'days'}`;
    case 'keep_saving':
    case 'dont_buy': {
      const base = v.status === 'dont_buy' ? 'Not safe to spend yet' : 'Keep saving';
      if (v.etaDate) return `${base} · should be safe around ${shortDate(v.etaDate, today)}`;
      return `${base} · ${formatMoney(v.shortfall)} to go`;
    }
  }
}
