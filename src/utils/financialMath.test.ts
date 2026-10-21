import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  calculateAccountBalance,
  calculateAllAccountBalances,
  calculateTotalBalance,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetCashFlow,
  calculateSavings,
  calculatePercentageChange,
  calculateCategoryBreakdown,
  getPeriodDateRange,
  getPreviousPeriodDateRange,
  filterTransactionsByDateRange,
  toISODateString,
} from './financialMath';
import type { Account } from '@/data/accounts';
import type { Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';

function makeTx(partial: Partial<Transaction> & { id: number; amount: number; isIncome: boolean }): Transaction {
  return {
    title: 'Тест',
    category: 'Тест',
    categoryIconName: 'HelpCircle',
    categoryId: null,
    date: '01 окт',
    dateISO: '2026-10-01',
    ...partial,
  };
}

describe('financialMath', () => {
  describe('roundMoney', () => {
    it('rounds floating point values to integers', () => {
      expect(roundMoney(100.4)).toBe(100);
      expect(roundMoney(100.6)).toBe(101);
      expect(roundMoney(-50.5)).toBe(-50);
    });

    it('handles non-finite values safely', () => {
      expect(roundMoney(NaN)).toBe(0);
      expect(roundMoney(Infinity)).toBe(0);
      expect(roundMoney(-Infinity)).toBe(0);
    });
  });

  describe('calculateAccountBalance', () => {
    const mainAccount: Account = {
      id: 'acc-main',
      name: 'Основной',
      type: 'card',
      initialBalance: 50000,
      currency: 'RUB',
      iconName: 'CreditCard',
      color: '#3B82F6',
      isArchived: false,
    };

    const savingsAccount: Account = {
      id: 'acc-savings',
      name: 'Накопления',
      type: 'savings',
      initialBalance: 100000,
      currency: 'RUB',
      iconName: 'PiggyBank',
      color: '#10B981',
      isArchived: false,
    };

    it('calculates balance with income and expenses', () => {
      const transactions: Transaction[] = [
        makeTx({
          id: 1,
          title: 'Зарплата',
          amount: 80000,
          date: '10 окт',
          dateISO: '2026-10-10',
          isIncome: true,
          accountId: 'acc-main',
        }),
        makeTx({
          id: 2,
          title: 'Супермаркет',
          amount: 5000,
          date: '11 окт',
          dateISO: '2026-10-11',
          isIncome: false,
          accountId: 'acc-main',
        }),
      ];

      const balance = calculateAccountBalance(mainAccount, transactions);
      // 50000 + 80000 - 5000 = 125000
      expect(balance).toBe(125000);
    });

    it('correctly adjusts balances for inter-account transfers without leaking into income/expenses', () => {
      const transactions: Transaction[] = [
        makeTx({
          id: 3,
          title: 'Перевод в накопления',
          amount: 20000,
          date: '12 окт',
          dateISO: '2026-10-12',
          isIncome: false,
          accountId: 'acc-main',
          toAccountId: 'acc-savings',
          isTransfer: true,
        }),
      ];

      const mainBal = calculateAccountBalance(mainAccount, transactions);
      const savingsBal = calculateAccountBalance(savingsAccount, transactions);

      // Main account: 50000 - 20000 = 30000
      expect(mainBal).toBe(30000);
      // Savings account: 100000 + 20000 = 120000
      expect(savingsBal).toBe(120000);

      // Total balance between both accounts is conserved: 150000
      expect(mainBal + savingsBal).toBe(150000);
    });

    it('absorbs legacy transactions without accountId when isDefaultAccount is true', () => {
      const legacyTx: Transaction[] = [
        makeTx({
          id: 4,
          title: 'Кафе',
          amount: 1500,
          date: '05 окт',
          dateISO: '2026-10-05',
          isIncome: false,
          // no accountId
        }),
      ];

      const balanceDefault = calculateAccountBalance(mainAccount, legacyTx, true);
      const balanceNonDefault = calculateAccountBalance(savingsAccount, legacyTx, false);

      expect(balanceDefault).toBe(48500);
      expect(balanceNonDefault).toBe(100000);
    });
  });

  describe('calculateTotalBalance & calculateAllAccountBalances', () => {
    const accounts: Account[] = [
      { id: 'acc-1', name: 'Карта', type: 'card', initialBalance: 10000, currency: 'RUB', iconName: 'CreditCard', isArchived: false },
      { id: 'acc-2', name: 'Наличные', type: 'cash', initialBalance: 5000, currency: 'RUB', iconName: 'Coins', isArchived: false },
      { id: 'acc-3', name: 'Архив', type: 'bank', initialBalance: 3000, currency: 'RUB', iconName: 'Landmark', isArchived: true },
    ];

    it('calculates map of all account balances', () => {
      const balances = calculateAllAccountBalances(accounts, []);
      expect(balances['acc-1']).toBe(10000);
      expect(balances['acc-2']).toBe(5000);
      expect(balances['acc-3']).toBe(3000);
    });

    it('calculates total balance strictly across active accounts', () => {
      const total = calculateTotalBalance(accounts, []);
      // 10000 + 5000 = 15000 (archived 3000 excluded from active total)
      expect(total).toBe(15000);
    });
  });

  describe('calculateTotalIncome and calculateTotalExpenses', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 1, title: 'Зарплата', amount: 100000, date: '01 окт', isIncome: true }),
      makeTx({ id: 2, title: 'Аренда', amount: 35000, date: '02 окт', isIncome: false }),
      makeTx({ id: 3, title: 'Перевод', amount: 15000, date: '03 окт', isIncome: false, isTransfer: true }),
    ];

    it('strictly excludes transfers from total income and total expenses', () => {
      const income = calculateTotalIncome(transactions);
      const expenses = calculateTotalExpenses(transactions);
      const net = calculateNetCashFlow(income, expenses);

      expect(income).toBe(100000);
      expect(expenses).toBe(35000);
      expect(net).toBe(65000);
    });
  });

  describe('calculateSavings', () => {
    it('computes savings amount and rate correctly', () => {
      const savings = calculateSavings(100000, 60000);
      expect(savings.amount).toBe(40000);
      expect(savings.rate).toBe(40);
    });

    it('handles deficit or zero income without negative rate or division by zero', () => {
      const deficitSavings = calculateSavings(50000, 70000);
      expect(deficitSavings.amount).toBe(0);
      expect(deficitSavings.rate).toBe(0);

      const zeroIncomeSavings = calculateSavings(0, 10000);
      expect(zeroIncomeSavings.amount).toBe(0);
      expect(zeroIncomeSavings.rate).toBe(0);
    });
  });

  describe('calculatePercentageChange', () => {
    it('calculates percentage changes correctly', () => {
      expect(calculatePercentageChange(120, 100)).toBe(20);
      expect(calculatePercentageChange(80, 100)).toBe(-20);
      expect(calculatePercentageChange(100, 100)).toBe(0);
    });

    it('returns null when previous value is zero', () => {
      expect(calculatePercentageChange(100, 0)).toBeNull();
    });
  });

  describe('calculateCategoryBreakdown', () => {
    const categories: CustomCategory[] = [
      { id: 'cat-food', name: 'Продукты', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
      { id: 'cat-transport', name: 'Транспорт', iconName: 'Car', isIncome: false, isArchived: false },
    ];

    it('groups transactions by category and computes percentage share', () => {
      const transactions: Transaction[] = [
        makeTx({ id: 1, title: 'Магазин 1', amount: 3000, categoryId: 'cat-food', category: 'Продукты', date: '01 окт', isIncome: false }),
        makeTx({ id: 2, title: 'Магазин 2', amount: 1000, categoryId: 'cat-food', category: 'Продукты', date: '02 окт', isIncome: false }),
        makeTx({ id: 3, title: 'Такси', amount: 1000, categoryId: 'cat-transport', category: 'Транспорт', date: '03 окт', isIncome: false }),
        // Transfer must be ignored
        makeTx({ id: 4, title: 'Перевод', amount: 5000, date: '04 окт', isIncome: false, isTransfer: true }),
      ];

      const breakdown = calculateCategoryBreakdown(transactions, categories, false);
      expect(breakdown).toHaveLength(2);
      // Ranked by total descending
      expect(breakdown[0].name).toBe('Продукты');
      expect(breakdown[0].amount).toBe(4000);
      expect(breakdown[0].percent).toBe(80);

      expect(breakdown[1].name).toBe('Транспорт');
      expect(breakdown[1].amount).toBe(1000);
      expect(breakdown[1].percent).toBe(20);
    });
  });

  describe('Date filtering utilities', () => {
    it('formats date to YYYY-MM-DD correctly', () => {
      const date = new Date(2026, 9, 15); // Month is 0-indexed: 9 = October
      expect(toISODateString(date)).toBe('2026-10-15');
    });

    it('filters transactions strictly within date range', () => {
      const transactions: Transaction[] = [
        makeTx({ id: 1, title: 'Tx 1', amount: 1000, date: '01 окт', dateISO: '2026-10-01', isIncome: true }),
        makeTx({ id: 2, title: 'Tx 2', amount: 2000, date: '15 окт', dateISO: '2026-10-15', isIncome: false }),
        makeTx({ id: 3, title: 'Tx 3', amount: 3000, date: '20 окт', dateISO: '2026-10-20', isIncome: false }),
        makeTx({ id: 4, title: 'Tx 4', amount: 4000, date: '01 ноя', dateISO: '2026-11-01', isIncome: true }),
      ];

      const filtered = filterTransactionsByDateRange(transactions, {
        startISO: '2026-10-10',
        endISO: '2026-10-25',
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual([2, 3]);
    });

    it('generates consistent previous periods for comparisons', () => {
      const now = new Date(2026, 9, 15);
      const currentMonth = getPeriodDateRange('current-month', now);
      const prevMonth = getPreviousPeriodDateRange(currentMonth);

      expect(currentMonth.startISO).toBe('2026-10-01');
      expect(prevMonth.endISO).toBe('2026-09-30');
    });
  });
});
