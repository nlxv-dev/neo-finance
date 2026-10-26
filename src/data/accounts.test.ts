import { describe, expect, it } from 'vitest';
import { createDefaultAccounts, MAIN_ACCOUNT_ID, normalizeStoredAccounts } from '@/data/accounts';

describe('account model and normalization', () => {
  it('creates only one deterministic default account and carries the legacy opening balance', () => {
    expect(createDefaultAccounts(-1_250)).toEqual([{
      id: MAIN_ACCOUNT_ID,
      name: 'Основной счёт',
      type: 'card',
      iconName: 'CreditCard',
      currency: 'RUB',
      initialBalance: -1_250,
      isArchived: false,
      color: 'mint',
    }]);
  });

  it('normalizes valid accounts without losing a negative balance or currency', () => {
    expect(normalizeStoredAccounts([{
      id: 'acc-usd',
      name: ' USD account ',
      type: 'cash',
      iconName: ' Coins ',
      currency: 'usd',
      initialBalance: -10,
      isArchived: true,
      color: 'blue',
    }])).toEqual([{
      id: 'acc-usd',
      name: 'USD account',
      type: 'cash',
      iconName: 'Coins',
      currency: 'USD',
      initialBalance: -10,
      isArchived: true,
      color: 'blue',
    }]);
  });

  it('rejects account lists and fields that exceed safe storage limits', () => {
    expect(normalizeStoredAccounts(Array.from({ length: 101 }, (_, index) => ({
      id: `acc-${index}`, name: `Account ${index}`, type: 'cash', iconName: 'Coins', initialBalance: 0,
    })))).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'a'.repeat(129), name: 'Cash', type: 'cash', iconName: 'Coins', initialBalance: 0 }])).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'acc-1', name: 'A'.repeat(81), type: 'cash', iconName: 'Coins', initialBalance: 0 }])).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'acc-1', name: 'Cash', type: 'cash', iconName: 'Coins', initialBalance: 1_000_000_000_001 }])).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'acc-1', name: 'Cash', type: 'cash', iconName: 'Coins', initialBalance: 10.5 }])).toBeNull();
  });

  it('uses safe defaults for an unknown account type but rejects malformed rows', () => {
    expect(normalizeStoredAccounts([{
      id: 'acc-1', name: 'Cash', type: 'unknown', iconName: 'Wallet', initialBalance: 0,
    }])?.[0].type).toBe('card');

    expect(normalizeStoredAccounts([{ id: 'acc-1', name: '', type: 'cash', iconName: 'Coins', initialBalance: 0 }])).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'acc-1', name: 'One', type: 'cash', iconName: 'Coins', initialBalance: 0 }, {
      id: 'acc-1', name: 'Duplicate', type: 'cash', iconName: 'Coins', initialBalance: 1,
    }])).toBeNull();
    expect(normalizeStoredAccounts([{ id: 'acc-1', name: 'Broken currency', type: 'cash', iconName: 'Coins', currency: 'US$', initialBalance: 0 }])).toBeNull();
    expect(normalizeStoredAccounts({ id: 'not-an-array' })).toBeNull();
  });
});
