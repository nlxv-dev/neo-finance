import { describe, expect, it } from 'vitest';
import { getCurrencySymbol } from '@/utils/currency';

describe('getCurrencySymbol', () => {
  it('returns familiar symbols for supported currencies', () => {
    expect(getCurrencySymbol('RUB')).toBe('₽');
    expect(getCurrencySymbol('usd')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('returns the currency code when a familiar symbol is not configured', () => {
    expect(getCurrencySymbol('CHF')).toBe('CHF');
  });
});
