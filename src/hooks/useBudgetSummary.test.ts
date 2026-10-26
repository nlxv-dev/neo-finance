import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/data/mockData';
import { useBudgetSummary } from './useBudgetSummary';

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    title: '',
    categoryId: 'def-1',
    category: 'Продукты',
    categoryIconName: 'ShoppingCart',
    amount: 0,
    date: '5 окт',
    dateISO: '2026-10-05',
    isIncome: false,
    ...overrides,
  };
}

describe('useBudgetSummary', () => {
  it('aggregates only transactions from the active month', () => {
    const transactions = [
      transaction({ id: 1, amount: 10_000, isIncome: true }),
      transaction({ id: 2, amount: 45_000 }),
      transaction({ id: 3, amount: 5_000, dateISO: '2026-09-30' }),
    ];

    const { result } = renderHook(() => useBudgetSummary(transactions, 50_000, '2026-10'));

    expect(result.current.currentMonthTransactions.map((item) => item.id)).toEqual([1, 2]);
    expect(result.current.monthlyIncome).toBe(10_000);
    expect(result.current.monthlyExpenses).toBe(45_000);
    expect(result.current.monthlyGrowth).toBe(-35_000);
    expect(result.current.safeToSpend).toBe(5_000);
    expect(result.current.budgetPercent).toBe(90);
    expect(result.current.budgetStatus).toBe('warning');
    expect(result.current.isOverbudget).toBe(false);
    expect(result.current.progressWidth).toBe(90);
  });

  it('caps progress and reports an overbudget state', () => {
    const transactions = [transaction({ amount: 60_000 })];

    const { result } = renderHook(() => useBudgetSummary(transactions, 50_000, '2026-10'));

    expect(result.current.budgetStatus).toBe('overbudget');
    expect(result.current.isOverbudget).toBe(true);
    expect(result.current.safeToSpend).toBe(-10_000);
    expect(result.current.progressWidth).toBe(100);
  });

  it('does not count account transfers as income or expenses', () => {
    const transactions = [
      transaction({ id: 1, amount: 1_000, isIncome: true }),
      transaction({ id: 2, amount: 250, isIncome: false }),
      transaction({ id: 3, amount: 5_000, isTransfer: true, accountId: 'acc-main', toAccountId: 'acc-cash' }),
    ];

    const { result } = renderHook(() => useBudgetSummary(transactions, 2_000, '2026-10'));

    expect(result.current.monthlyIncome).toBe(1_000);
    expect(result.current.monthlyExpenses).toBe(250);
    expect(result.current.monthlyGrowth).toBe(750);
    expect(result.current.safeToSpend).toBe(1_750);
  });
});
