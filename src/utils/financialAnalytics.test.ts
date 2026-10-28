import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/data/categories';
import {
  buildCategoryStatistics,
  buildCategoryPeriodChanges,
  buildDailyStatistics,
  calculatePeriodStatistics,
  getDaysInMonth,
  getMonthKey,
  getStatisticsComparisonPeriods,
  selectStatisticsTransactions,
  selectStatisticsTransactionsInRange,
} from '@/utils/financialAnalytics';

const categories: CustomCategory[] = [
  { id: 'food', name: 'Продукты и еда', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
  { id: 'salary', name: 'Зарплата', iconName: 'BriefcaseBusiness', isIncome: true, isArchived: false },
];

const transactions: Transaction[] = [
  {
    id: 1, title: 'Магазин', categoryId: 'food', category: 'Еда', categoryIconName: 'Utensils',
    amount: 300, date: '2026-10-02', dateISO: '2026-10-02', accountId: 'acc-main', isIncome: false,
  },
  {
    id: 2, title: 'Супермаркет', categoryId: 'food', category: 'Еда', categoryIconName: 'Utensils',
    amount: 700, date: '2026-10-03', dateISO: '2026-10-03', accountId: 'acc-main', isIncome: false,
  },
  {
    id: 3, title: 'Зарплата', categoryId: 'salary', category: 'Зарплата', categoryIconName: 'Banknote',
    amount: 5_000, date: '2026-10-05', dateISO: '2026-10-05', accountId: 'acc-main', isIncome: true,
  },
  {
    id: 4, title: 'В копилку', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight',
    amount: 1_000, date: '2026-10-06', dateISO: '2026-10-06', accountId: 'acc-main',
    toAccountId: 'acc-savings', isIncome: false, isTransfer: true,
  },
  {
    id: 5, title: 'Такси', categoryId: null, category: 'Транспорт', categoryIconName: 'Car',
    amount: 250, date: '2026-09-30', dateISO: '2026-09-30', accountId: 'acc-main', isIncome: false,
  },
];

describe('financialAnalytics period selection and totals', () => {
  it('selects only the requested month and never counts an internal transfer', () => {
    const selected = selectStatisticsTransactions(transactions, '2026-10', 'month', '2026-10-26');
    expect(selected.map((transaction) => transaction.id)).toEqual([1, 2, 3]);
    expect(calculatePeriodStatistics(selected)).toEqual({ income: 5_000, expenses: 1_000, net: 4_000 });
  });

  it('selects an exact local calendar day', () => {
    const selected = selectStatisticsTransactions(transactions, '2026-10', 'day', '2026-10-03');
    expect(selected.map((transaction) => transaction.id)).toEqual([2]);
    expect(calculatePeriodStatistics(selected)).toEqual({ income: 0, expenses: 700, net: -700 });
  });

  it('generates a zero-filled daily series and does not mutate the input', () => {
    const selected = selectStatisticsTransactions(transactions, '2026-10', 'month', '2026-10-26');
    const snapshot = selected.map((transaction) => transaction.id);
    const points = buildDailyStatistics(selected, 4);

    expect(points).toEqual([
      { day: 1, income: 0, expenses: 0 },
      { day: 2, income: 0, expenses: 300 },
      { day: 3, income: 0, expenses: 700 },
      { day: 4, income: 0, expenses: 0 },
    ]);
    expect(selected.map((transaction) => transaction.id)).toEqual(snapshot);
    expect(buildDailyStatistics(selected, 40)).toHaveLength(31);
    expect(buildDailyStatistics(selected, -3)).toEqual([]);
  });

  it('groups spending in the combined view and uses the canonical category snapshot', () => {
    const selected = selectStatisticsTransactions(transactions, '2026-10', 'month', '2026-10-26');
    const stats = buildCategoryStatistics(selected, categories, 'all', 5_000, 1_000);

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      key: 'food', name: 'Продукты и еда', iconName: 'ShoppingCart', amount: 1_000, percent: 100,
    });
    expect(stats[0].transactions.map((transaction) => transaction.id)).toEqual([2, 1]);
  });

  it('groups income separately when income mode is selected', () => {
    const selected = selectStatisticsTransactions(transactions, '2026-10', 'month', '2026-10-26');
    const stats = buildCategoryStatistics(selected, categories, 'income', 5_000, 1_000);
    expect(stats.map(({ name, amount, percent }) => ({ name, amount, percent }))).toEqual([
      { name: 'Зарплата', amount: 5_000, percent: 100 },
    ]);
  });

  it('uses the legacy category name when no stable category ID exists', () => {
    const legacy = { ...transactions[0], id: 7, categoryId: null, category: '  Кофе  ' };
    const stats = buildCategoryStatistics([legacy], [], 'expense', 0, 300);
    expect(stats[0]).toMatchObject({ key: 'legacy:кофе', name: 'Кофе', amount: 300, percent: 100 });
  });
});

describe('financialAnalytics calendar helpers', () => {
  it('uses local calendar fields and handles leap years', () => {
    expect(getMonthKey(new Date(2026, 9, 27))).toBe('2026-10');
    expect(getDaysInMonth(new Date(2024, 1, 1))).toBe(29);
    expect(getDaysInMonth(new Date(2026, 1, 1))).toBe(28);
  });
});

describe('financialAnalytics comparison periods', () => {
  it('compares a selected day with the previous local calendar day across month boundaries', () => {
    expect(getStatisticsComparisonPeriods('day', '2026-01', '2026-01-01', new Date('2026-01-01T12:00:00'))).toEqual({
      current: { startDateISO: '2026-01-01', endDateISO: '2026-01-01' },
      previous: { startDateISO: '2025-12-31', endDateISO: '2025-12-31' },
    });
  });

  it('compares month-to-date with the same day number from the previous month', () => {
    expect(getStatisticsComparisonPeriods('month', '2026-10', '2026-10-27', new Date('2026-10-27T17:00:00'))).toEqual({
      current: { startDateISO: '2026-10-01', endDateISO: '2026-10-27' },
      previous: { startDateISO: '2026-09-01', endDateISO: '2026-09-27' },
    });
  });

  it('caps a month-to-date comparison at the final day of a shorter previous month', () => {
    expect(getStatisticsComparisonPeriods('month', '2024-03', '2024-03-31', new Date('2024-03-31T12:00:00'))).toEqual({
      current: { startDateISO: '2024-03-01', endDateISO: '2024-03-31' },
      previous: { startDateISO: '2024-02-01', endDateISO: '2024-02-29' },
    });
  });

  it('compares historical months as complete calendar months', () => {
    expect(getStatisticsComparisonPeriods('month', '2026-10', '2026-10-10', new Date('2026-11-15T12:00:00'))).toEqual({
      current: { startDateISO: '2026-10-01', endDateISO: '2026-10-31' },
      previous: { startDateISO: '2026-09-01', endDateISO: '2026-09-30' },
    });
  });

  it('does not include future-dated transactions in current-month totals', () => {
    const future = { ...transactions[0], id: 80, date: '2026-10-30', dateISO: '2026-10-30' };
    const current = selectStatisticsTransactions(
      [...transactions, future], '2026-10', 'month', '2026-10-27', new Date('2026-10-27T12:00:00'),
    );
    expect(current.map(({ id }) => id)).not.toContain(80);
    expect(current.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('selects a range inclusively and excludes internal transfers', () => {
    const selected = selectStatisticsTransactionsInRange(transactions, {
      startDateISO: '2026-10-02',
      endDateISO: '2026-10-06',
    }, new Date('2026-10-27T12:00:00'));
    expect(selected.map(({ id }) => id)).toEqual([1, 2, 3]);
  });
});



describe('financialAnalytics category period changes', () => {
  const current: Transaction[] = [
    { id: 101, title: 'Покупки сейчас', categoryId: 'food', category: 'Еда', categoryIconName: 'ShoppingCart', amount: 1_200, date: '2 окт', dateISO: '2026-10-02', accountId: 'acc-main', isIncome: false },
    { id: 102, title: 'Кофе сейчас', categoryId: null, category: '  Кофе  ', categoryIconName: 'Coffee', amount: 100, date: '3 окт', dateISO: '2026-10-03', accountId: 'acc-main', isIncome: false },
    { id: 103, title: 'Зарплата сейчас', categoryId: 'salary', category: 'Зарплата', categoryIconName: 'Banknote', amount: 5_000, date: '5 окт', dateISO: '2026-10-05', accountId: 'acc-main', isIncome: true },
    { id: 104, title: 'В копилку', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight', amount: 9_999, date: '6 окт', dateISO: '2026-10-06', accountId: 'acc-main', toAccountId: 'acc-savings', isIncome: false, isTransfer: true },
  ];
  const previous: Transaction[] = [
    { id: 201, title: 'Покупки раньше', categoryId: 'food', category: 'Еда', categoryIconName: 'ShoppingCart', amount: 800, date: '2 сен', dateISO: '2026-09-02', accountId: 'acc-main', isIncome: false },
    { id: 202, title: 'Кофе раньше', categoryId: null, category: 'кофе', categoryIconName: 'Coffee', amount: 150, date: '3 сен', dateISO: '2026-09-03', accountId: 'acc-main', isIncome: false },
    { id: 203, title: 'Зарплата раньше', categoryId: 'salary', category: 'Зарплата', categoryIconName: 'Banknote', amount: 4_500, date: '5 сен', dateISO: '2026-09-05', accountId: 'acc-main', isIncome: true },
    { id: 204, title: 'Старый перевод', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight', amount: 8_000, date: '6 сен', dateISO: '2026-09-06', accountId: 'acc-main', toAccountId: 'acc-savings', isIncome: false, isTransfer: true },
  ];

  it('ranks expense changes by absolute difference and excludes internal transfers', () => {
    const changes = buildCategoryPeriodChanges(current, previous, categories, 'all');

    expect(changes.map(({ key, name, currentAmount, previousAmount, difference }) => ({
      key, name, currentAmount, previousAmount, difference,
    }))).toEqual([
      { key: 'food', name: 'Продукты и еда', currentAmount: 1_200, previousAmount: 800, difference: 400 },
      { key: 'legacy:кофе', name: 'Кофе', currentAmount: 100, previousAmount: 150, difference: -50 },
    ]);
  });

  it('compares income categories only when income mode is selected', () => {
    const changes = buildCategoryPeriodChanges(current, previous, categories, 'income');
    expect(changes.map(({ key, currentAmount, previousAmount, difference }) => ({
      key, currentAmount, previousAmount, difference,
    }))).toEqual([
      { key: 'salary', currentAmount: 5_000, previousAmount: 4_500, difference: 500 },
    ]);
  });

  it('omits categories whose amounts did not change', () => {
    const currentSame = [{ ...current[0], amount: 800 }];
    const previousSame = [{ ...previous[0], amount: 800 }];
    expect(buildCategoryPeriodChanges(currentSame, previousSame, categories, 'expense')).toEqual([]);
  });
});
