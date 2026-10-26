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
    expect(screen.getByText('Такси')).toBeInTheDocument();
    expect(screen.queryByText('Кафе')).not.toBeInTheDocument();
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
});
