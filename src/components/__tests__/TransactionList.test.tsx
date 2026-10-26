import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionList } from '@/components/TransactionList';
import type { Transaction } from '@/data/mockData';

function makeTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 1_700_000_000_000 + index,
    title: `Покупка ${index + 1}`,
    categoryId: null,
    category: 'Продукты',
    categoryIconName: 'Utensils',
    amount: (index + 1) * 100,
    date: '26 окт',
    dateISO: '2026-10-26',
    accountId: 'acc-main',
    isIncome: false,
  }));
}

describe('Home transaction list', () => {
  it('shows at most ten transactions initially and reveals ten more per click', () => {
    render(
      <TransactionList
        transactions={makeTransactions(23)}
        accounts={[]}
        categories={[]}
      />,
    );

    const getTransactionRows = () => screen.getAllByRole('button', { name: /Транзакция:/ });
    expect(getTransactionRows()).toHaveLength(10);

    const firstMoreButton = screen.getByRole('button', { name: /Показать ещё/ });
    expect(within(firstMoreButton).getByText('13')).toBeInTheDocument();
    fireEvent.click(firstMoreButton);
    expect(getTransactionRows()).toHaveLength(20);

    const secondMoreButton = screen.getByRole('button', { name: /Показать ещё/ });
    expect(within(secondMoreButton).getByText('3')).toBeInTheDocument();
    fireEvent.click(secondMoreButton);
    expect(getTransactionRows()).toHaveLength(23);
    expect(screen.queryByRole('button', { name: /Показать ещё/ })).not.toBeInTheDocument();
  });

  it('does not show the expand control when there are ten or fewer transactions', () => {
    render(
      <TransactionList
        transactions={makeTransactions(10)}
        accounts={[]}
        categories={[]}
      />,
    );

    expect(screen.getAllByRole('button', { name: /Транзакция:/ })).toHaveLength(10);
    expect(screen.queryByRole('button', { name: /Показать ещё/ })).not.toBeInTheDocument();
  });
});
