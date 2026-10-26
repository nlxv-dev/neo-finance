import { describe, expect, it } from 'vitest';
import { createDefaultAccounts, MAIN_ACCOUNT_ID, type Account } from '@/data/accounts';
import {
  calculateAccountBalance,
  calculateAccountOpeningBalanceForTargetBalance,
  calculateAllAccountBalances,
  calculateBalancesByCurrency,
  calculateTotalBalance,
  calculateMainOpeningBalanceForTargetTotal,
  getPrimaryAccountId,
  migrateLegacyFinanceToAccounts,
  roundMoney,
  type AccountTransaction,
} from '@/utils/financialMath';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: MAIN_ACCOUNT_ID,
  name: 'Основной счёт',
  type: 'card',
  iconName: 'CreditCard',
  currency: 'RUB',
  initialBalance: 10_000,
  isArchived: false,
  ...overrides,
});

describe('financialMath', () => {
  it('rounds finite whole-unit amounts and guards against non-finite values', () => {
    expect(roundMoney(10.6)).toBe(11);
    expect(roundMoney(-10.6)).toBe(-11);
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('preserves the legacy balance when old transactions have no accountId', () => {
    const legacyInitialBalance = 15_000;
    const transactions: AccountTransaction[] = [
      { amount: 2_500, isIncome: true },
      { amount: 1_200, isIncome: false },
      { amount: 300, isIncome: false },
    ];
    const [mainAccount] = createDefaultAccounts(legacyInitialBalance);

    const oldFormula = legacyInitialBalance + 2_500 - 1_200 - 300;
    const newFormula = calculateTotalBalance([mainAccount], transactions);

    expect(newFormula).toBe(oldFormula);
    expect(calculateAccountBalance(mainAccount, transactions)).toBe(oldFormula);
  });

  it('migrates legacy data without mutating it or changing the total balance', () => {
    const legacyInitialBalance = 15_000;
    const legacyTransactions = [
      { id: 1, amount: 2_500, isIncome: true },
      { id: 2, amount: 1_200, isIncome: false },
    ];
    const migration = migrateLegacyFinanceToAccounts(legacyInitialBalance, legacyTransactions);

    expect(migration.accounts).toHaveLength(1);
    expect(migration.accounts[0].id).toBe(MAIN_ACCOUNT_ID);
    expect(migration.accounts[0].initialBalance).toBe(legacyInitialBalance);
    expect(migration.transactions.map((transaction) => transaction.accountId)).toEqual([
      MAIN_ACCOUNT_ID,
      MAIN_ACCOUNT_ID,
    ]);
    expect(calculateTotalBalance(migration.accounts, migration.transactions)).toBe(16_300);
    expect(legacyTransactions[0]).not.toHaveProperty('accountId');
  });

  it('retains negative opening balances', () => {
    const negativeAccount = account({ initialBalance: -4_500 });
    expect(calculateAccountBalance(negativeAccount, [])).toBe(-4_500);
    expect(calculateAccountBalance(negativeAccount, [{ amount: 500, isIncome: true }])).toBe(-4_000);
  });

  it('adjusts one account current balance without changing the other account', () => {
    const main = account({ initialBalance: 5_000 });
    const savings = account({ id: 'acc-savings', name: 'Накопления', initialBalance: 0 });
    const accounts = [main, savings];
    const transactions: AccountTransaction[] = [
      { amount: 500, isIncome: false, accountId: MAIN_ACCOUNT_ID },
      { amount: 3_000, isIncome: false, isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-savings' },
    ];

    expect(calculateAllAccountBalances(accounts, transactions)).toEqual({ [MAIN_ACCOUNT_ID]: 1_500, 'acc-savings': 3_000 });
    expect(calculateAccountOpeningBalanceForTargetBalance(MAIN_ACCOUNT_ID, accounts, transactions, 2_500)).toBe(6_000);
    expect(calculateAccountOpeningBalanceForTargetBalance('acc-savings', accounts, transactions, 2_000)).toBe(-1_000);
  });

  it('assigns legacy unassigned transactions to the stable main account', () => {
    const main = account();
    const cash = account({ id: 'acc-cash', name: 'Наличные', initialBalance: 500 });
    const transactions: AccountTransaction[] = [
      { amount: 100, isIncome: true },
      { amount: 200, isIncome: false, accountId: 'acc-cash' },
    ];

    expect(calculateAllAccountBalances([main, cash], transactions)).toEqual({
      'acc-main': 10_100,
      'acc-cash': 300,
    });
  });

  it('keeps transactions with orphaned account references in the main total', () => {
    const main = account({ initialBalance: 1_000 });
    const transactions: AccountTransaction[] = [
      { amount: 250, isIncome: true, accountId: 'acc-missing' },
      { amount: 100, isIncome: false, accountId: 'acc-missing' },
    ];

    expect(calculateTotalBalance([main], transactions)).toBe(1_150);
    expect(calculateMainOpeningBalanceForTargetTotal([main], transactions, 500)).toBe(350);
  });

  it('includes archived account balances so archiving cannot make money disappear', () => {
    const main = account({ initialBalance: 1_000 });
    const archived = account({
      id: 'acc-old',
      name: 'Старый счёт',
      initialBalance: 2_000,
      isArchived: true,
    });

    expect(calculateTotalBalance([main, archived], [])).toBe(3_000);
    expect(calculateBalancesByCurrency([main, archived], [])).toEqual({ RUB: 3_000 });
  });

  it('never combines balances in different currencies', () => {
    const accounts = [
      account({ initialBalance: 1_000 }),
      account({ id: 'acc-usd', name: 'USD account', currency: 'USD', initialBalance: 100 }),
      account({ id: 'acc-eur', name: 'EUR account', currency: 'EUR', initialBalance: 50 }),
    ];

    expect(calculateBalancesByCurrency(accounts, [])).toEqual({ RUB: 1_000, USD: 100, EUR: 50 });
    expect(calculateTotalBalance(accounts, [])).toBe(1_000);
    expect(calculateTotalBalance(accounts, [], 0, 'USD')).toBe(100);
  });

  it('moves money between account balances without changing the combined balance', () => {
    const accounts = [
      account({ initialBalance: 10_000 }),
      account({ id: 'acc-cash', name: 'Наличные', initialBalance: 500 }),
    ];
    const transactions: AccountTransaction[] = [
      { amount: 1_000, isIncome: true, accountId: MAIN_ACCOUNT_ID },
      { amount: 200, isIncome: false, accountId: MAIN_ACCOUNT_ID },
      { amount: 300, isIncome: false, isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' },
    ];

    expect(calculateAllAccountBalances(accounts, transactions)).toEqual({
      [MAIN_ACCOUNT_ID]: 10_500,
      'acc-cash': 800,
    });
    expect(calculateTotalBalance(accounts, transactions)).toBe(11_300);
  });

  it('reconciles missing transfer endpoints into the main account without losing the transferred amount', () => {
    const accounts = [account({ initialBalance: 1_000 }), account({ id: 'acc-cash', initialBalance: 500 })];
    const transactions: AccountTransaction[] = [
      { amount: 200, isIncome: false, isTransfer: true, accountId: 'acc-missing', toAccountId: 'acc-cash' },
    ];
    expect(calculateAllAccountBalances(accounts, transactions)).toEqual({
      [MAIN_ACCOUNT_ID]: 800,
      'acc-cash': 700,
    });
    expect(calculateTotalBalance(accounts, transactions)).toBe(1_500);
  });

  it('keeps target-balance adjustments correct when transfers are present', () => {
    const accounts = [
      account({ initialBalance: 10_000 }),
      account({ id: 'acc-cash', initialBalance: 1_000 }),
    ];
    const transactions: AccountTransaction[] = [
      { amount: 300, isTransfer: true, isIncome: false, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' },
    ];
    const nextOpeningBalance = calculateMainOpeningBalanceForTargetTotal(accounts, transactions, 12_000);
    const nextAccounts = accounts.map((item) => item.id === MAIN_ACCOUNT_ID
      ? { ...item, initialBalance: nextOpeningBalance }
      : item);
    expect(calculateTotalBalance(nextAccounts, transactions)).toBe(12_000);
  });

  it('uses the RUB legacy fallback when no accounts exist yet', () => {
    expect(calculateBalancesByCurrency([], [
      { amount: 400, isIncome: true },
      { amount: 100, isIncome: false },
    ], 2_000)).toEqual({ RUB: 2_300 });
    expect(getPrimaryAccountId([])).toBe(MAIN_ACCOUNT_ID);
  });

  it('adjusts the main opening balance to hit a target total without changing other accounts', () => {
    const accounts = [
      account({ initialBalance: 10_000 }),
      account({ id: 'acc-cash', name: 'Наличные', initialBalance: 2_000 }),
      account({ id: 'acc-usd', name: 'USD', currency: 'USD', initialBalance: 300 }),
    ];
    const transactions: AccountTransaction[] = [
      { amount: 1_000, isIncome: true, accountId: MAIN_ACCOUNT_ID },
      { amount: 500, isIncome: false, accountId: MAIN_ACCOUNT_ID },
      { amount: 250, isIncome: true, accountId: 'acc-cash' },
    ];

    const adjustedOpening = calculateMainOpeningBalanceForTargetTotal(accounts, transactions, 15_000);
    const nextAccounts = accounts.map((item) => item.id === MAIN_ACCOUNT_ID
      ? { ...item, initialBalance: adjustedOpening }
      : item);

    expect(adjustedOpening).toBe(12_250);
    expect(calculateTotalBalance(nextAccounts, transactions)).toBe(15_000);
    expect(nextAccounts.find((item) => item.id === 'acc-usd')?.initialBalance).toBe(300);
  });
});
