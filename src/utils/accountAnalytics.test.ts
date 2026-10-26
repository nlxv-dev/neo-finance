import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/data/mockData';
import { calculateAccountMonthlyMovement, filterTransactionsForAccount, filterTransactionsForCurrency, getOtherCurrencyCodes, summarizeAccountTransactions } from '@/utils/accountAnalytics';

const transactions: Transaction[] = [
  { id: 1, title: 'Еда', categoryId: 'food', category: 'Еда', categoryIconName: 'Utensils', amount: 120, date: '1 окт', accountId: 'acc-main', isIncome: false },
  { id: 2, title: 'Зарплата', categoryId: 'salary', category: 'Зарплата', categoryIconName: 'Banknote', amount: 2_000, date: '2 окт', accountId: 'acc-main', isIncome: true },
  { id: 3, title: 'Кофе', categoryId: 'coffee', category: 'Кофе', categoryIconName: 'Coffee', amount: 80, date: '3 окт', accountId: 'acc-cash', isIncome: false },
  { id: 4, title: 'Legacy', categoryId: null, category: 'Прочее', categoryIconName: 'HelpCircle', amount: 30, date: '4 окт', isIncome: false },
];

describe('accountAnalytics', () => {
  it('filters only transactions assigned to the selected account', () => {
    expect(filterTransactionsForAccount(transactions, 'acc-cash').map((tx) => tx.id)).toEqual([3]);
  });

  it('includes unassigned legacy rows in the stable main account', () => {
    expect(filterTransactionsForAccount(transactions, 'acc-main').map((tx) => tx.id)).toEqual([1, 2, 4]);
    expect(summarizeAccountTransactions(transactions, 'acc-main')).toEqual({
      income: 2_000,
      expenses: 150,
      net: 1_850,
      count: 3,
    });
  });

  it('attributes orphaned account references to the main account until reconciliation', () => {
    const withOrphan = [...transactions, { ...transactions[2], id: 5, accountId: 'acc-deleted' }];
    expect(filterTransactionsForAccount(withOrphan, 'acc-main', ['acc-main', 'acc-cash']).map((tx) => tx.id)).toEqual([1, 2, 4, 5]);
    expect(summarizeAccountTransactions(withOrphan, 'acc-main', ['acc-main', 'acc-cash']).expenses).toBe(230);
  });

  it('keeps currency aggregates isolated and reports the currencies present in accounts', () => {
    const accounts = [
      { id: 'acc-main', currency: 'RUB' },
      { id: 'acc-cash', currency: 'RUB' },
      { id: 'acc-usd', currency: 'USD' },
      { id: 'acc-eur', currency: 'EUR' },
    ];
    const multiCurrency = [...transactions, { ...transactions[2], id: 6, accountId: 'acc-usd' }];
    expect(filterTransactionsForCurrency(multiCurrency, accounts, 'RUB').map((tx) => tx.id)).toEqual([1, 2, 3, 4]);
    expect(filterTransactionsForCurrency(multiCurrency, accounts, 'USD').map((tx) => tx.id)).toEqual([6]);
    expect(getOtherCurrencyCodes(accounts)).toEqual(['EUR', 'USD']);
  });

  it('does not leak activity between accounts', () => {
    expect(summarizeAccountTransactions(transactions, 'acc-cash')).toEqual({
      income: 0,
      expenses: 80,
      net: -80,
      count: 1,
    });
  });

  it('shows a transfer in both account histories but excludes it from income and expense totals', () => {
    const transfer: Transaction = {
      id: 8,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: 500,
      date: '8 окт',
      accountId: 'acc-main',
      toAccountId: 'acc-cash',
      isIncome: false,
      isTransfer: true,
    };
    const withTransfer = [...transactions, transfer];

    expect(filterTransactionsForAccount(withTransfer, 'acc-main').map((tx) => tx.id)).toContain(8);
    expect(filterTransactionsForAccount(withTransfer, 'acc-cash').map((tx) => tx.id)).toContain(8);
    expect(summarizeAccountTransactions(withTransfer, 'acc-main')).toEqual({ income: 2_000, expenses: 150, net: 1_850, count: 4 });
    expect(summarizeAccountTransactions(withTransfer, 'acc-cash')).toEqual({ income: 0, expenses: 80, net: -80, count: 2 });
  });
});

describe('calculateAccountMonthlyMovement', () => {
  const monthTransactions: Transaction[] = [
    { id: 101, title: 'Такси', categoryId: 'transport', category: 'Транспорт', categoryIconName: 'Car', amount: 500, date: '2026-10-04', dateISO: '2026-10-04', accountId: 'acc-main', isIncome: false },
    { id: 102, title: 'Зарплата', categoryId: 'salary', category: 'Зарплата', categoryIconName: 'BriefcaseBusiness', amount: 2_000, date: '2026-10-05', dateISO: '2026-10-05', accountId: 'acc-main', isIncome: true },
    { id: 103, title: 'Перевод', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight', amount: 3_000, date: '2026-10-08', dateISO: '2026-10-08', accountId: 'acc-main', toAccountId: 'acc-savings', isIncome: false, isTransfer: true },
    { id: 104, title: 'Возврат', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight', amount: 1_500, date: '2026-10-10', dateISO: '2026-10-10', accountId: 'acc-savings', toAccountId: 'acc-main', isIncome: false, isTransfer: true },
    { id: 105, title: 'Такси прошлой недели', categoryId: 'transport', category: 'Транспорт', categoryIconName: 'Car', amount: 200, date: '2026-09-29', dateISO: '2026-09-29', accountId: 'acc-main', isIncome: false },
  ];

  it('shows movement per account and month, includes transfers but excludes opening balance', () => {
    expect(calculateAccountMonthlyMovement(monthTransactions, 'acc-main', '2026-10', ['acc-main', 'acc-savings'])).toBe(0);
    expect(calculateAccountMonthlyMovement(monthTransactions, 'acc-savings', '2026-10', ['acc-main', 'acc-savings'])).toBe(1_500);
  });

  it('keeps regular expenses and transfers scoped to the selected account', () => {
    expect(calculateAccountMonthlyMovement(monthTransactions, 'acc-main', '2026-09', ['acc-main', 'acc-savings'])).toBe(-200);
    expect(calculateAccountMonthlyMovement(monthTransactions, 'acc-savings', '2026-09', ['acc-main', 'acc-savings'])).toBe(0);
  });
});
