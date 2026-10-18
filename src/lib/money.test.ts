import { describe, expect, it } from 'vitest';
import { backspace, pressKey } from './amountInput';
import { formatInput, formatMoney, parseToMinor, type CurrencyFormat } from './money';

const usd: CurrencyFormat = { symbol: '$', indianGrouping: false, minorDigits: 2 };

describe('formatMoney', () => {
  it('uses Indian grouping by default', () => {
    expect(formatMoney(0)).toBe('₹0');
    expect(formatMoney(99_900)).toBe('₹999');
    expect(formatMoney(100_000)).toBe('₹1,000');
    expect(formatMoney(12_345_600)).toBe('₹1,23,456');
    expect(formatMoney(123_456_700)).toBe('₹12,34,567');
    expect(formatMoney(1_000_000_000)).toBe('₹1,00,00,000');
  });

  it('supports Western grouping', () => {
    expect(formatMoney(123_456_700, { format: usd })).toBe('$1,234,567');
  });

  it('handles decimal modes', () => {
    expect(formatMoney(124_000)).toBe('₹1,240');
    expect(formatMoney(124_050)).toBe('₹1,240.50');
    expect(formatMoney(124_000, { decimals: 'always' })).toBe('₹1,240.00');
    expect(formatMoney(124_099, { decimals: 'never' })).toBe('₹1,240'); // truncates
    expect(formatMoney(5)).toBe('₹0.05');
  });

  it('handles signs', () => {
    expect(formatMoney(-85_000)).toBe('\u2212₹850');
    expect(formatMoney(85_000, { signed: true })).toBe('+₹850');
    expect(formatMoney(0, { signed: true })).toBe('₹0');
  });
});

describe('formatInput', () => {
  it('formats while typing', () => {
    expect(formatInput('')).toBe('0');
    expect(formatInput('1234.')).toBe('1,234.');
    expect(formatInput('123456.7')).toBe('1,23,456.7');
    expect(formatInput('0.')).toBe('0.');
  });
});

describe('parseToMinor', () => {
  it('parses valid input', () => {
    expect(parseToMinor('250')).toBe(25_000);
    expect(parseToMinor('250.5')).toBe(25_050);
    expect(parseToMinor('0.05')).toBe(5);
    expect(parseToMinor('.5')).toBe(50);
    expect(parseToMinor('250.')).toBe(25_000);
  });

  it('rejects bad input', () => {
    expect(parseToMinor('')).toBeNull();
    expect(parseToMinor('1.234')).toBeNull();
    expect(parseToMinor('1.2.3')).toBeNull();
    expect(parseToMinor('12a')).toBeNull();
  });
});

describe('keypad rules', () => {
  const type = (...keys: string[]) => keys.reduce(pressKey, '');

  it('has no leading zeros', () => expect(type('0', '0', '5')).toBe('5'));
  it('starts a decimal from empty', () => expect(type('.')).toBe('0.'));
  it('allows two decimals', () => expect(type('1', '.', '2', '5', '9')).toBe('1.25'));
  it('ignores a second dot', () => expect(type('1', '.', '.')).toBe('1.'));
  it('caps whole digits at nine', () => expect(type(...'9'.repeat(12))).toBe('999999999'));
  it('backspaces', () => {
    expect(backspace('1.25')).toBe('1.2');
    expect(backspace('')).toBe('');
  });
});
