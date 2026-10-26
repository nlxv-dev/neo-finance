import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { CustomCategory } from '@/hooks/useCategories';
import { useTransactions } from './useTransactions';

const STORAGE_KEY = 'fintrack-transactions';
const category: CustomCategory = {
  id: 'cat-food',
  name: 'Продукты',
  iconName: 'ShoppingCart',
  isIncome: false,
  isArchived: false,
};

function storedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Продукты',
    categoryId: 'cat-food',
    category: 'Продукты',
    categoryIconName: 'ShoppingCart',
    amount: 250,
    date: '25 окт',
    dateISO: '2026-10-25',
    isIncome: false,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useTransactions account compatibility', () => {
  it('assigns historical transactions without accountId to the main account and persists the migration', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([storedTransaction()]));

    const { result } = renderHook(() => useTransactions([category]));

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].accountId).toBe(MAIN_ACCOUNT_ID);
  });

  it('preserves an existing accountId when loading, editing and persisting a transaction', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([storedTransaction({ accountId: 'acc-cash' })]));

    const { result } = renderHook(() => useTransactions([category]));
    expect(result.current.transactions[0].accountId).toBe('acc-cash');

    act(() => result.current.updateTransaction(1, { amount: 300 }));

    expect(result.current.transactions[0].accountId).toBe('acc-cash');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].accountId).toBe('acc-cash');
  });

  it('assigns new transactions to the main account unless an account is explicitly supplied', () => {
    const { result } = renderHook(() => useTransactions([category]));

    act(() => result.current.addTransaction({ amount: 100, categoryId: category.id, isIncome: false }));

    expect(result.current.transactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].accountId).toBe(MAIN_ACCOUNT_ID);
  });

  it('supports explicitly reassigning a regular transaction to another account', () => {
    const { result } = renderHook(() => useTransactions([category]));
    act(() => result.current.addTransaction({ amount: 100, categoryId: category.id, isIncome: false }));
    const transactionId = result.current.transactions[0].id;

    act(() => result.current.updateTransaction(transactionId, { accountId: 'acc-cash' }));

    expect(result.current.transactions[0].accountId).toBe('acc-cash');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].accountId).toBe('acc-cash');
  });

  it('reconnects orphaned transaction account references to the main account once accounts are validated', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([storedTransaction({ accountId: 'acc-missing' })]));
    const { result } = renderHook(() => useTransactions([category]));

    act(() => result.current.reconcileAccountReferences([MAIN_ACCOUNT_ID]));

    expect(result.current.transactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].accountId).toBe(MAIN_ACCOUNT_ID);
  });

  it('does not overwrite malformed transaction account data', () => {
    const rawValue = JSON.stringify([storedTransaction({ accountId: 42 })]);
    window.localStorage.setItem(STORAGE_KEY, rawValue);

    const { result } = renderHook(() => useTransactions([category]));

    expect(result.current.transactions).toEqual([]);
    expect(result.current.storageIssues.some((issue) => issue.kind === 'invalid-data')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawValue);
  });

  it('adds transfers as one source/destination record and prevents generic editing from changing their meaning', () => {
    const { result } = renderHook(() => useTransactions([category]));

    act(() => result.current.addTransfer({ amount: 400, fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' }));

    const transfer = result.current.transactions[0];
    expect(transfer).toMatchObject({
      amount: 400,
      accountId: MAIN_ACCOUNT_ID,
      toAccountId: 'acc-cash',
      isIncome: false,
      isTransfer: true,
    });

    act(() => result.current.updateTransaction(transfer.id, {
      amount: 999,
      categoryId: category.id,
      isIncome: true,
      accountId: 'acc-cash',
    }));

    expect(result.current.transactions[0]).toEqual(transfer);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].toAccountId).toBe('acc-cash');
  });

  it('keeps transaction IDs unique when a regular entry and transfer are added in the same millisecond', () => {
    const { result } = renderHook(() => useTransactions([category]));
    vi.spyOn(Date, 'now').mockReturnValue(123);

    try {
      act(() => {
        result.current.addTransaction({ amount: 100, categoryId: category.id, isIncome: false });
        result.current.addTransfer({ amount: 50, fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' });
      });

      const ids = result.current.transactions.map((transaction) => transaction.id);
      expect(ids).toEqual([124, 123]);
      expect(new Set(ids).size).toBe(2);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('preserves malformed transfer rows instead of silently dropping transfer data', () => {
    const rawValue = JSON.stringify([storedTransaction({ isTransfer: true, accountId: MAIN_ACCOUNT_ID })]);
    window.localStorage.setItem(STORAGE_KEY, rawValue);

    const { result } = renderHook(() => useTransactions([category]));

    expect(result.current.transactions).toEqual([]);
    expect(result.current.storageIssues.some((issue) => issue.kind === 'invalid-data')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawValue);
  });

  it('preserves zero-value or income-marked transfer rows as unreadable instead of normalizing them silently', () => {
    for (const overrides of [
      { amount: 0, isIncome: false },
      { amount: 100, isIncome: true },
    ]) {
      window.localStorage.clear();
      const rawValue = JSON.stringify([storedTransaction({
        isTransfer: true,
        accountId: MAIN_ACCOUNT_ID,
        toAccountId: 'acc-cash',
        categoryId: null,
        category: 'Перевод',
        title: 'Перевод между счетами',
        categoryIconName: 'ArrowLeftRight',
        ...overrides,
      })]);
      window.localStorage.setItem(STORAGE_KEY, rawValue);
      const { result, unmount } = renderHook(() => useTransactions([category]));

      expect(result.current.transactions).toEqual([]);
      expect(result.current.storageIssues.some((issue) => issue.kind === 'invalid-data')).toBe(true);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawValue);
      unmount();
    }
  });

  it('reconciles one missing transfer endpoint without producing a self-transfer', () => {
    const rawValue = JSON.stringify([storedTransaction({
      isTransfer: true,
      isIncome: false,
      accountId: 'acc-missing-source',
      toAccountId: 'acc-cash',
      categoryId: null,
      category: 'Перевод',
      title: 'Перевод между счетами',
      categoryIconName: 'ArrowLeftRight',
    })]);
    window.localStorage.setItem(STORAGE_KEY, rawValue);
    const { result } = renderHook(() => useTransactions([category]));

    act(() => result.current.reconcileAccountReferences([MAIN_ACCOUNT_ID, 'acc-cash']));

    expect(result.current.transactions[0]).toMatchObject({
      accountId: MAIN_ACCOUNT_ID,
      toAccountId: 'acc-cash',
      isTransfer: true,
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')[0].toAccountId).toBe('acc-cash');
  });
});
