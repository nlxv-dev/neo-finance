import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BalanceCardCarousel, ADD_ACCOUNT_CARD_KEY } from '@/components/BalanceCardCarousel';
import { createMainAccount, type Account } from '@/data/accounts';

const mainAccount = createMainAccount(5_000);
const savingsAccount: Account = {
  id: 'acc-savings',
  name: 'Копилочка',
  type: 'savings',
  iconName: 'PiggyBank',
  currency: 'RUB',
  initialBalance: 0,
  isArchived: false,
  color: 'indigoblue',
};

function makeProps(activeCardKey = mainAccount.id) {
  return {
    accounts: [mainAccount, savingsAccount],
    accountBalances: { [mainAccount.id]: 5_000, [savingsAccount.id]: 3_000 },
    transactions: [],
    currentMonthKey: '2026-10',
    activeCardKey,
    canWriteAccounts: true,
    onSelectCard: vi.fn(),
    onEditBalance: vi.fn(),
    onAddAccount: vi.fn(),
  };
}

describe('BalanceCardCarousel', () => {
  it('starts on the main balance card and has no swipe-caption text', () => {
    render(<BalanceCardCarousel {...makeProps()} />);

    expect(screen.getByText('Основной баланс')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Изменить текущий баланс/ })).toBeInTheDocument();
    expect(screen.queryByText(/свайпните|смахните/i)).not.toBeInTheDocument();
  });

  it('offers an accessible plus card that requests account creation', () => {
    const props = makeProps();
    const { rerender } = render(<BalanceCardCarousel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Перейти к созданию нового счёта' }));
    expect(props.onSelectCard).toHaveBeenCalledWith(ADD_ACCOUNT_CARD_KEY);

    rerender(<BalanceCardCarousel {...props} activeCardKey={ADD_ACCOUNT_CARD_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Создать новый счёт' }));
    expect(props.onAddAccount).toHaveBeenCalledTimes(1);
  });

  it('opens the balance adjustment for the selected account', () => {
    const props = makeProps(savingsAccount.id);
    render(<BalanceCardCarousel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Изменить текущий баланс «Копилочка»/ }));
    expect(props.onEditBalance).toHaveBeenCalledWith(savingsAccount.id);
  });
});
