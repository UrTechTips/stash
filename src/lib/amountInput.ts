/**
 * Rules for the quick-add keypad. The state is just the text typed so far
 * ("", "0.", "250", "250.5"). A plain string is easy to keep in useState and to unit test.
 */
export const MAX_WHOLE_DIGITS = 9;
export const MAX_DECIMALS = 2;

export function pressKey(current: string, key: string): string {
  if (/^\d$/.test(key)) return pressDigit(current, key);
  if (key === '.') return pressDot(current);
  return current;
}

export function backspace(current: string): string {
  return current.slice(0, -1);
}

function pressDigit(current: string, digit: string): string {
  const dot = current.indexOf('.');
  if (dot >= 0) {
    // already in the decimal part
    return current.length - dot - 1 >= MAX_DECIMALS ? current : current + digit;
  }
  if (current === '0') return digit; // no leading zeros: "0" then "5" -> "5"
  if (current.length >= MAX_WHOLE_DIGITS) return current;
  return current + digit;
}

function pressDot(current: string): string {
  if (current.includes('.')) return current;
  if (current.length === 0) return '0.';
  return `${current}.`;
}
