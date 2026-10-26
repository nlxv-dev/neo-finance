import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import { useAccounts } from './useAccounts';

const STORAGE_KEY = 'fintrack-accounts';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useAccounts legacy migration and safe storage', () => {
  it('initializes the main account from the legacy profile opening balance exactly once', () => {
    const { result } = renderHook(() => useAccounts(12_500));

    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0]).toMatchObject({
      id: MAIN_ACCOUNT_ID,
      initialBalance: 12_500,
      currency: 'RUB',
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')).toEqual(result.current.accounts);
    expect(result.current.canWrite).toBe(true);
  });

  it('does not overwrite malformed account storage', () => {
    const rawValue = JSON.stringify([{ id: 'acc-main', name: 'Broken', initialBalance: 'not-a-number' }]);
    window.localStorage.setItem(STORAGE_KEY, rawValue);

    const { result } = renderHook(() => useAccounts(5_000));

    expect(result.current.accounts[0].initialBalance).toBe(5_000);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.storageIssues.some((issue) => issue.kind === 'invalid-data')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawValue);
  });

  it('allows non-main accounts to be archived and restored, but never archives the main account', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: MAIN_ACCOUNT_ID, name: 'Основной счёт', type: 'card', iconName: 'CreditCard', currency: 'RUB', initialBalance: 900, isArchived: false },
      { id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 350, isArchived: false },
    ]));

    const { result } = renderHook(() => useAccounts(900));
    act(() => result.current.setAccountArchived('acc-cash', true));
    expect(result.current.accounts.find((account) => account.id === 'acc-cash')?.isArchived).toBe(true);

    act(() => result.current.setAccountArchived('acc-cash', false));
    expect(result.current.accounts.find((account) => account.id === 'acc-cash')?.isArchived).toBe(false);

    act(() => result.current.setAccountArchived(MAIN_ACCOUNT_ID, true));
    expect(result.current.accounts.find((account) => account.id === MAIN_ACCOUNT_ID)?.isArchived).toBe(false);
  });

  it('refuses to accept an account list without the permanent main account', () => {
    const rawValue = JSON.stringify([{
      id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins',
      currency: 'RUB', initialBalance: 200, isArchived: false,
    }]);
    window.localStorage.setItem(STORAGE_KEY, rawValue);

    const { result } = renderHook(() => useAccounts(0));

    expect(result.current.accounts[0].id).toBe(MAIN_ACCOUNT_ID);
    expect(result.current.canWrite).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawValue);
  });
});
