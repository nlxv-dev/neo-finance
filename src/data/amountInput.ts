export const MAX_AMOUNT_DIGITS = 9;

/** Append a single digit while normalizing leading zeroes and enforcing the amount limit. */
export function appendAmountDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit)) return current;
  const normalized = current.replace(/^0+/, '');
  if (normalized.length >= MAX_AMOUNT_DIGITS) return normalized;
  return `${normalized}${digit}`.slice(0, MAX_AMOUNT_DIGITS);
}
