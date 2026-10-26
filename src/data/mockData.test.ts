import { describe, expect, it } from 'vitest';
import { formatCurrency, getBudgetStatus } from './mockData';

describe('getBudgetStatus', () => {
  it.each([
    [0, 100, 'normal'],
    [79.99, 100, 'normal'],
    [80, 100, 'warning'],
    [100, 100, 'warning'],
    [100.01, 100, 'overbudget'],
    [0, 0, 'normal'],
    [100, 0, 'normal'],
    [100, -50, 'normal'],
  ] as const)('returns %s for %s spent of %s', (spent, budget, expected) => {
    expect(getBudgetStatus(spent, budget)).toBe(expected);
  });
});

describe('formatCurrency', () => {
  it('formats whole rubles with Russian thousands separators', () => {
    expect(formatCurrency(1234567)).toBe('1\u00a0234\u00a0567');
  });

  it('keeps negative balances readable', () => {
    expect(formatCurrency(-1500)).toBe('-1\u00a0500');
  });

  it('formats fractional values without losing precision', () => {
    expect(formatCurrency(1234.5)).toBe('1\u00a0234,5');
  });
});
