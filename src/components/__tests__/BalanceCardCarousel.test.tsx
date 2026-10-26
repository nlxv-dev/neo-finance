import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BalanceCardCarousel } from '@/components/BalanceCardCarousel';
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

function makeProps() {
  return {
    accounts: [mainAccount, savingsAccount],
    accountBalances: { [mainAccount.id]: 5_000, [savingsAccount.id]: 3_000 },
    transactions: [],
    currentMonthKey: '2026-10',
    canWriteAccounts: true,
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
    render(<BalanceCardCarousel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Перейти к созданию нового счёта' }));
    fireEvent.click(screen.getByRole('button', { name: 'Создать новый счёт' }));
    expect(props.onAddAccount).toHaveBeenCalledTimes(1);
  });

  it('selects a newly-created account without lifting carousel state into App', async () => {
    const props = makeProps();
    const newAccount: Account = {
      id: 'acc-new',
      name: 'Новый счёт',
      type: 'cash',
      iconName: 'Coins',
      currency: 'RUB',
      initialBalance: 0,
      isArchived: false,
    };
    const { rerender } = render(<BalanceCardCarousel {...props} />);

    rerender(
      <BalanceCardCarousel
        {...props}
        accounts={[...props.accounts, newAccount]}
        accountBalances={{ ...props.accountBalances, [newAccount.id]: 0 }}
      />,
    );

    expect(await screen.findByRole('button', { name: /Изменить текущий баланс «Новый счёт»/ })).toBeInTheDocument();
  });

  it('opens the balance adjustment for the selected account', () => {
    const props = makeProps();
    render(<BalanceCardCarousel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Показать счёт: Копилочка' }));
    fireEvent.click(screen.getByRole('button', { name: /Изменить текущий баланс «Копилочка»/ }));
    expect(props.onEditBalance).toHaveBeenCalledWith(savingsAccount.id);
  });
});
