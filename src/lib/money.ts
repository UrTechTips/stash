/**
 * Money is always an integer count of minor units (paise / cents).
 * Never store or add rupees as floats: 0.1 + 0.2 !== 0.3 in JavaScript.
 *
 * Pure TypeScript on purpose: no React Native imports, so it runs in plain Vitest
 * and can move into the engine package later.
 */
export type Minor = number;

export type CurrencyFormat = {
  symbol: string;
  /** 12,34,567 (lakh/crore) when true, 1,234,567 when false. */
  indianGrouping: boolean;
  /** 2 for paise/cents. */
  minorDigits: number;
};

export const INR: CurrencyFormat = { symbol: '₹', indianGrouping: true, minorDigits: 2 };

// The app-wide default currency (changed from Settings). Pure code can still pass its own format.
let currentCurrency: CurrencyFormat = INR;
export const getCurrency = (): CurrencyFormat => currentCurrency;
export const setCurrency = (format: CurrencyFormat): void => {
  currentCurrency = format;
};

/**
 * 'auto'   show decimals only when they are not zero: ₹1,240 but ₹1,240.50
 * 'always' always show them
 * 'never'  truncate toward zero, so a "safe to spend" figure never overstates
 */
export type DecimalMode = 'auto' | 'always' | 'never';

const MINUS = '\u2212'; // a real minus sign, not a hyphen

export function formatMoney(
  minor: Minor,
  options: { format?: CurrencyFormat; decimals?: DecimalMode; signed?: boolean } = {},
): string {
  const { format = currentCurrency, decimals = 'auto', signed = false } = options;
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const divisor = 10 ** format.minorDigits;
  const whole = Math.trunc(abs / divisor);
  const fraction = abs % divisor;

  const showFraction =
    format.minorDigits > 0 &&
    (decimals === 'always' || (decimals === 'auto' && fraction !== 0));
  const fractionText = showFraction
    ? '.' + String(fraction).padStart(format.minorDigits, '0')
    : '';

  const sign = negative ? MINUS : signed && minor > 0 ? '+' : '';
  return `${sign}${format.symbol}${group(String(whole), format.indianGrouping)}${fractionText}`;
}

/**
 * Formats text while the user is still typing on the keypad.
 * "1234." -> "1,234."   "1234.5" -> "1,234.5"   "" -> "0"
 */
export function formatInput(input: string, format: CurrencyFormat = currentCurrency): string {
  if (input.length === 0) return '0';
  const dot = input.indexOf('.');
  const whole = dot >= 0 ? input.slice(0, dot) : input;
  const rest = dot >= 0 ? input.slice(dot) : '';
  return group(whole || '0', format.indianGrouping) + rest;
}

/**
 * Parses keypad text ("250", "250.5", "0.05") into minor units.
 * Returns null for empty or malformed input. Extra decimals are rejected, not rounded.
 */
export function parseToMinor(input: string, minorDigits = 2): Minor | null {
  if (input.length === 0) return null;
  const parts = input.split('.');
  if (parts.length > 2) return null;
  const wholeText = parts[0] || '0';
  const fractionText = parts[1] ?? '';
  if (!/^\d+$/.test(wholeText) || !/^\d*$/.test(fractionText)) return null;
  if (fractionText.length > minorDigits) return null;
  const fraction = fractionText.padEnd(minorDigits, '0') || '0';
  return Number(wholeText) * 10 ** minorDigits + Number(fraction);
}

function group(digits: string, indian: boolean): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const size = indian ? 2 : 3;
  const parts: string[] = [];
  for (let end = head.length; end > 0; end -= size) {
    parts.unshift(head.slice(Math.max(0, end - size), end));
  }
  return `${parts.join(',')},${tail}`;
}

/** Minor units -> the text a keypad or text field would hold: 25050 -> "250.5", 25000 -> "250". */
export function minorToInput(minor: Minor, minorDigits = 2): string {
  const divisor = 10 ** minorDigits;
  const whole = Math.trunc(Math.abs(minor) / divisor);
  const fraction = String(Math.abs(minor) % divisor).padStart(minorDigits, '0').replace(/0+$/, '');
  return `${minor < 0 ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}
