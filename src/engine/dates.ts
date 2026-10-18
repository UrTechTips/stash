/**
 * Calendar-date helpers on 'YYYY-MM-DD' strings. They avoid the Date-in-local-time trap:
 * all arithmetic goes through UTC day numbers, so daylight saving and time zones cannot
 * shift a date by one.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function parseISO(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export const toISO = (y: number, m: number, d: number): ISODate => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

const toDayNumber = (date: ISODate): number => {
  const { y, m, d } = parseISO(date);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

const fromDayNumber = (n: number): ISODate => {
  const dt = new Date(n * DAY_MS);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};

export const isISODate = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDayNumber(toDayNumber(s)) === s;

export const addDays = (date: ISODate, n: number): ISODate => fromDayNumber(toDayNumber(date) + n);

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: ISODate, b: ISODate): number => toDayNumber(b) - toDayNumber(a);

export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 'YYYY-MM' of a date. */
export const monthOf = (date: ISODate): string => date.slice(0, 7);

export const startOfMonth = (date: ISODate): ISODate => `${monthOf(date)}-01`;

export const endOfMonth = (date: ISODate): ISODate => {
  const { y, m } = parseISO(date);
  return toISO(y, m, daysInMonth(y, m));
};

/** Moves by whole months, keeping the day when possible (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(date);
  const index = y * 12 + (m - 1) + n;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** 'YYYY-MM' shifted by n months. */
export const shiftMonth = (month: string, n: number): string => monthOf(addMonths(`${month}-01`, n));

/** Today's date on the phone's calendar, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export const compareISO = (a: ISODate, b: ISODate): number => (a < b ? -1 : a > b ? 1 : 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "14 Oct" (adds the year when it is not the same year as `relativeTo`). */
export function shortDate(date: ISODate, relativeTo?: ISODate): string {
  const { y, m, d } = parseISO(date);
  const sameYear = !relativeTo || parseISO(relativeTo).y === y;
  return `${d} ${MONTHS[m - 1]}${sameYear ? '' : ` ${y}`}`;
}

/** "October 2026" from 'YYYY-MM'. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export const monthShort = (month: string): string => MONTHS[Number(month.split('-')[1]) - 1];

/** "Today", "Yesterday", or "Mon, 12 Oct". */
export function dayLabel(date: ISODate, today: ISODate): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const { y, m, d } = parseISO(date);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${shortDate(date, today)}`;
}
