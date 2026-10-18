import { addDays, addMonths, daysInMonth, isISODate, parseISO, toISO, type ISODate } from '../engine/dates';
import { assert, type Db } from './Db';
import { addTransaction } from './transactions';
import type { Cadence, Minor, RecurringRule } from './types';

type Row = {
  id: number;
  type: 'expense' | 'income';
  amount: number;
  account_id: number;
  category_id: number | null;
  note: string;
  cadence: Cadence;
  next_due: string;
  anchor_day: number;
  active: number;
};

const map = (r: Row): RecurringRule => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  accountId: r.account_id,
  categoryId: r.category_id,
  note: r.note,
  cadence: r.cadence,
  nextDue: r.next_due,
  anchorDay: r.anchor_day,
  active: r.active === 1,
});

/** Moves by whole months but sticks to the anchor day (a rule on the 31st returns to the 31st after February). */
function addMonthsAnchored(date: ISODate, n: number, anchorDay: number): ISODate {
  const shifted = addMonths(`${date.slice(0, 7)}-01`, n);
  const { y, m } = parseISO(shifted);
  return toISO(y, m, Math.min(anchorDay, daysInMonth(y, m)));
}

/** The date after `date` for a cadence. */
export function advance(date: ISODate, cadence: Cadence, anchorDay: number): ISODate {
  if (cadence === 'weekly') return addDays(date, 7);
  return addMonthsAnchored(date, cadence === 'monthly' ? 1 : 12, anchorDay);
}

export interface RecurringInput {
  type: 'expense' | 'income';
  amount: Minor;
  accountId: number;
  categoryId?: number | null;
  note?: string;
  cadence: Cadence;
  /** The first (or next) date it is due. */
  startDate: ISODate;
}

function validate(input: RecurringInput) {
  assert(Number.isInteger(input.amount) && input.amount > 0, 'Enter an amount greater than zero.');
  assert(isISODate(input.startDate), 'That date is not valid.');
  assert(input.accountId > 0, 'Pick an account.');
}

export async function listRules(db: Db, opts: { activeOnly?: boolean } = {}): Promise<RecurringRule[]> {
  const where = opts.activeOnly ? 'WHERE active = 1' : '';
  return (await db.all<Row>(`SELECT * FROM recurring_rules ${where} ORDER BY next_due, id`)).map(map);
}

export async function createRule(db: Db, input: RecurringInput): Promise<number> {
  validate(input);
  const r = await db.run(
    `INSERT INTO recurring_rules (type, amount, account_id, category_id, note, cadence, next_due, anchor_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.type,
      input.amount,
      input.accountId,
      input.categoryId ?? null,
      (input.note ?? '').trim(),
      input.cadence,
      input.startDate,
      parseISO(input.startDate).d,
    ],
  );
  return r.lastInsertRowId;
}

export async function updateRule(db: Db, id: number, input: RecurringInput): Promise<void> {
  validate(input);
  await db.run(
    `UPDATE recurring_rules SET type = ?, amount = ?, account_id = ?, category_id = ?, note = ?,
            cadence = ?, next_due = ?, anchor_day = ? WHERE id = ?`,
    [
      input.type,
      input.amount,
      input.accountId,
      input.categoryId ?? null,
      (input.note ?? '').trim(),
      input.cadence,
      input.startDate,
      parseISO(input.startDate).d,
      id,
    ],
  );
}

export async function setRuleActive(db: Db, id: number, active: boolean): Promise<void> {
  await db.run('UPDATE recurring_rules SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}

export async function deleteRule(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

/**
 * Turns every rule occurrence that is due on or before `today` into a real transaction and moves
 * the rule forward. Each rule runs in one transaction. Returns how many transactions were created.
 */
export async function materializeDue(db: Db, today: ISODate): Promise<number> {
  const due = (await listRules(db, { activeOnly: true })).filter((r) => r.nextDue <= today);
  let created = 0;
  for (const rule of due) {
    await db.transaction(async (tx) => {
      let next = rule.nextDue;
      let guard = 0; // a phone left off for years should still finish
      while (next <= today && guard++ < 600) {
        await addTransaction(tx, {
          type: rule.type,
          amount: rule.amount,
          date: next,
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          note: rule.note,
          recurringId: rule.id,
        });
        created += 1;
        next = advance(next, rule.cadence, rule.anchorDay);
      }
      await tx.run('UPDATE recurring_rules SET next_due = ? WHERE id = ?', [next, rule.id]);
    });
  }
  return created;
}

export interface Occurrence {
  rule: RecurringRule;
  date: ISODate;
}

/** Every future occurrence of the active rules with `from <= date <= to`, sorted by date. */
export function occurrencesBetween(rules: RecurringRule[], from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    let d = rule.nextDue;
    let guard = 0;
    while (d <= to && guard++ < 600) {
      if (d >= from) out.push({ rule, date: d });
      d = advance(d, rule.cadence, rule.anchorDay);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rule.id - b.rule.id));
}
