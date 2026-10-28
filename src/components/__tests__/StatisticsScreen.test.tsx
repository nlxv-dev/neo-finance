import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import type { Transaction } from '@/data/mockData';

const transactions: Transaction[] = [
  {
    id: 1,
    title: 'Кофе',
    categoryId: null,
    category: 'Кафе',
    categoryIconName: 'Coffee',
    amount: 500,
    date: '26 окт',
    dateISO: '2026-10-26',
    accountId: 'acc-main',
    isIncome: false,
  },
  {
    id: 2,
    title: 'Зарплата',
    categoryId: null,
    category: 'Зарплата',
    categoryIconName: 'Banknote',
    amount: 2500,
    date: '26 окт',
    dateISO: '2026-10-26',
    accountId: 'acc-main',
    isIncome: true,
  },
  {
    id: 3,
    title: 'Такси',
    categoryId: null,
    category: 'Такси',
    categoryIconName: 'Car',
    amount: 300,
    date: '25 окт',
    dateISO: '2026-10-25',
    accountId: 'acc-main',
    isIncome: false,
  },
  {
    id: 4,
    title: 'Перевод в копилку',
    categoryId: null,
    category: 'Перевод',
    categoryIconName: 'ArrowLeftRight',
    amount: 1000,
    date: '26 окт',
    dateISO: '2026-10-26',
    accountId: 'acc-main',
    toAccountId: 'acc-savings',
    isIncome: false,
    isTransfer: true,
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StatisticsScreen daily and monthly views', () => {
  it('filters the selected day and excludes internal transfers', () => {
    render(
      <StatisticsScreen
        transactions={transactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'День' }));
    fireEvent.click(screen.getByRole('button', { name: 'Расходы' }));

    expect(screen.getByText('Расходы за сегодня')).toBeInTheDocument();
    expect(screen.getByText('Кафе')).toBeInTheDocument();
    expect(screen.queryByText('Такси')).not.toBeInTheDocument();
    expect(screen.queryByText('Перевод')).not.toBeInTheDocument();
    expect(screen.getByText('Расходы за день')).toBeInTheDocument();
  });

  it('moves to yesterday and updates daily totals and categories', () => {
    render(
      <StatisticsScreen
        transactions={transactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'День' }));
    fireEvent.click(screen.getByRole('button', { name: 'Расходы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }));

    expect(screen.getByText('Расходы за вчера')).toBeInTheDocument();

    // The category label and the transaction title can both be 'Такси'.
    // Target the expandable category row instead of an ambiguous text match.
    const taxiCategory = screen.getAllByText('Такси').find(
      (element) => element.closest('button[aria-expanded]') !== null,
    );
    expect(taxiCategory).toBeInTheDocument();

    const cafeCategory = screen.queryAllByText('Кафе').find(
      (element) => element.closest('button[aria-expanded]') !== null,
    );
    expect(cafeCategory).toBeUndefined();
  });

  it('keeps the existing monthly graph as the default view', () => {
    render(
      <StatisticsScreen
        transactions={transactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'График доходов и расходов за Октябрь 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Месяц' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a comparison against the same elapsed period in the previous month', () => {
    const comparisonTransactions: Transaction[] = [
      {
        id: 20, title: 'Текущий доход', categoryId: null, category: 'Доход', categoryIconName: 'Banknote',
        amount: 1000, date: '1 окт', dateISO: '2026-10-01', accountId: 'acc-main', isIncome: true,
      },
      {
        id: 21, title: 'Предыдущий доход', categoryId: null, category: 'Доход', categoryIconName: 'Banknote',
        amount: 500, date: '1 сен', dateISO: '2026-09-01', accountId: 'acc-main', isIncome: true,
      },
    ];

    render(
      <StatisticsScreen
        transactions={comparisonTransactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    const comparison = screen.getByRole('region', { name: 'Сравнение с предыдущим периодом' });
    expect(comparison).toHaveTextContent('Чистый итог выше на 500 ₽');
    expect(comparison).toHaveTextContent('1–26 окт 2026');
    expect(comparison).toHaveTextContent('1–26 сен 2026');
  });

  it('updates the comparison when daily mode is selected', () => {
    render(
      <StatisticsScreen
        transactions={transactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'День' }));
    const comparison = screen.getByRole('region', { name: 'Сравнение с предыдущим периодом' });
    expect(comparison).toHaveTextContent('26 окт 2026');
    expect(comparison).toHaveTextContent('25 окт 2026');
    expect(comparison).toHaveTextContent('Чистый итог выше на 2 300 ₽');
  });

  it('describes a zero previous income baseline without inventing an infinite percentage', () => {
    const onlyCurrentIncome: Transaction[] = [{
      id: 30, title: 'Зарплата', categoryId: null, category: 'Доход', categoryIconName: 'Banknote',
      amount: 2500, date: '26 окт', dateISO: '2026-10-26', accountId: 'acc-main', isIncome: true,
    }];

    render(
      <StatisticsScreen
        transactions={onlyCurrentIncome}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Доходы' }));
    const comparison = screen.getByRole('region', { name: 'Сравнение с предыдущим периодом' });
    expect(comparison).toHaveTextContent('В предыдущем периоде доходов не было');
    expect(comparison).not.toHaveTextContent('Infinity');
  });

  it('keeps the monthly chart pointer-driven without slider keyboard controls', () => {
    render(
      <StatisticsScreen
        transactions={transactions}
        categories={[]}
        onSelectTransaction={vi.fn()}
      />,
    );

    const graph = screen.getByRole('img', { name: 'График доходов и расходов за Октябрь 2026' });
    expect(graph).not.toHaveAttribute('tabindex');
    expect(graph).not.toHaveAttribute('aria-valuenow');
    expect(graph).not.toHaveAttribute('aria-valuetext');
  });

  it('explains which expense category changed between comparable monthly periods', () => {
    const categoryComparisonTransactions: Transaction[] = [
      {
        id: 50, title: 'Покупки сейчас', categoryId: 'food', category: 'Еда', categoryIconName: 'ShoppingCart',
        amount: 900, date: '1 окт', dateISO: '2026-10-01', accountId: 'acc-main', isIncome: false,
      },
      {
        id: 51, title: 'Покупки раньше', categoryId: 'food', category: 'Еда', categoryIconName: 'ShoppingCart',
        amount: 600, date: '1 сен', dateISO: '2026-09-01', accountId: 'acc-main', isIncome: false,
      },
    ];

    render(
      <StatisticsScreen
        transactions={categoryComparisonTransactions}
        categories={[{ id: 'food', name: 'Продукты и еда', iconName: 'ShoppingCart', isIncome: false, isArchived: false }]}
        onSelectTransaction={vi.fn()}
      />,
    );

    const changes = screen.getByRole('region', { name: 'Изменения по категориям' });
    expect(changes).toHaveTextContent('Продукты и еда');
    expect(changes).toHaveTextContent('600 ₽ → 900 ₽');
    expect(changes).toHaveTextContent('+300 ₽');
    expect(changes).toHaveTextContent('1–26 сен 2026 → 1–26 окт 2026');
  });

});
