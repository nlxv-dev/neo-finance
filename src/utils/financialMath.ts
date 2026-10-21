import type { Transaction } from '@/data/mockData';
import type { Account } from '@/data/accounts';
import type { CustomCategory } from '@/hooks/useCategories';
import { resolveTransactionDateISO } from '@/data/transactionDates';

/**
 * Ensures clean monetary arithmetic, avoiding JS floating-point artifacts.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * Calculates the current balance of a specific account based on its initial balance
 * and all associated transactions (including incoming and outgoing transfers).
 *
 * @param account The account to compute balance for.
 * @param transactions Full list of transactions.
 * @param isDefaultAccount Whether this account absorbs unassigned / legacy transactions.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  isDefaultAccount = false
): number {
  let balance = roundMoney(account.initialBalance);

  for (const tx of transactions) {
    if (tx.isTransfer) {
      if (tx.accountId === account.id) {
        // Outgoing transfer from this account
        balance -= roundMoney(tx.amount);
      }
      if (tx.toAccountId === account.id) {
        // Incoming transfer to this account
        balance += roundMoney(tx.amount);
      }
      continue;
    }

    // Regular income or expense
    const matchesAccount =
      tx.accountId === account.id ||
      (isDefaultAccount && (!tx.accountId || tx.accountId === ''));

    if (matchesAccount) {
      if (tx.isIncome) {
        balance += roundMoney(tx.amount);
      } else {
        balance -= roundMoney(tx.amount);
      }
    }
  }

  return balance;
}

/**
 * Calculates current balances for all accounts in one pass.
 */
export function calculateAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Record<string, number> {
  const primaryId = accounts.find((a) => !a.isArchived)?.id ?? accounts[0]?.id ?? 'acc-main';
  const balances: Record<string, number> = {};

  for (const acc of accounts) {
    balances[acc.id] = calculateAccountBalance(acc, transactions, acc.id === primaryId);
  }

  return balances;
}

/**
 * Calculates total balance across all active accounts.
 */
export function calculateTotalBalance(
  accounts: Account[],
  transactions: Transaction[],
  fallbackInitialBalance = 0
): number {
  if (accounts.length === 0) {
    const income = calculateTotalIncome(transactions);
    const expenses = calculateTotalExpenses(transactions);
    return roundMoney(fallbackInitialBalance + income - expenses);
  }

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const primaryId = activeAccounts[0]?.id ?? accounts[0]?.id;
  let total = 0;

  for (const acc of activeAccounts) {
    total += calculateAccountBalance(acc, transactions, acc.id === primaryId);
  }

  return total;
}

/**
 * Calculates total income from non-transfer transactions.
 */
export function calculateTotalIncome(transactions: Transaction[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (!tx.isTransfer && tx.isIncome) {
      sum += roundMoney(tx.amount);
    }
  }
  return sum;
}

/**
 * Calculates total expenses from non-transfer transactions.
 */
export function calculateTotalExpenses(transactions: Transaction[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (!tx.isTransfer && !tx.isIncome) {
      sum += roundMoney(tx.amount);
    }
  }
  return sum;
}

/**
 * Calculates net cash flow (Income - Expenses).
 * Accepts either an array of transactions or numeric (income, expenses).
 */
export function calculateNetCashFlow(
  transactionsOrIncome: Transaction[] | number,
  expenses?: number
): number {
  if (typeof transactionsOrIncome === 'number') {
    return roundMoney(transactionsOrIncome - (expenses ?? 0));
  }
  return calculateTotalIncome(transactionsOrIncome) - calculateTotalExpenses(transactionsOrIncome);
}

/**
 * Calculates savings amount and savings rate percentage.
 */
export function calculateSavings(
  income: number,
  expenses: number
): { savingsAmount: number; savingsRate: number; amount: number; rate: number } {
  const savingsAmount = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? Math.round((savingsAmount / income) * 100) : 0;
  return {
    savingsAmount,
    savingsRate,
    amount: savingsAmount,
    rate: savingsRate,
  };
}

export interface CategoryBreakdownItem {
  key: string;
  id: string | null;
  name: string;
  iconName: string;
  amount: number;
  percent: number;
  count: number;
}

/**
 * Generates an aggregated breakdown by category for expenses or income.
 */
export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: CustomCategory[],
  isIncome: boolean
): CategoryBreakdownItem[] {
  const relevantTx = transactions.filter(
    (tx) => !tx.isTransfer && tx.isIncome === isIncome
  );

  const total = relevantTx.reduce((sum, tx) => sum + roundMoney(tx.amount), 0);
  const map = new Map<string, { name: string; iconName: string; amount: number; count: number }>();

  for (const tx of relevantTx) {
    const key = tx.categoryId ?? `legacy:${tx.category.trim().toLocaleLowerCase('ru-RU')}`;
    const linked = categories.find((c) => c.id === tx.categoryId);
    const name = linked?.name ?? tx.category ?? 'Без категории';
    const iconName = linked?.iconName ?? tx.categoryIconName ?? 'HelpCircle';

    const existing = map.get(key);
    if (existing) {
      existing.amount += roundMoney(tx.amount);
      existing.count += 1;
    } else {
      map.set(key, {
        name,
        iconName,
        amount: roundMoney(tx.amount),
        count: 1,
      });
    }
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [key, data] of map.entries()) {
    const percent = total > 0 ? Math.round((data.amount / total) * 100) : 0;
    const isLegacy = key.startsWith('legacy:');
    items.push({
      key,
      id: isLegacy ? null : key,
      name: data.name,
      iconName: data.iconName,
      amount: data.amount,
      percent,
      count: data.count,
    });
  }

  return items.sort((a, b) => b.amount - a.amount);
}

export type PeriodType = 'current-month' | 'previous-month' | 'last-7-days' | 'last-30-days' | 'current-year' | 'custom';

export interface DateRange {
  startISO: string; // YYYY-MM-DD
  endISO: string;   // YYYY-MM-DD
}

/**
 * Formats a Date object to YYYY-MM-DD in local time.
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns date range for a specified standard period.
 */
export function getPeriodDateRange(period: PeriodType, referenceDate = new Date()): DateRange {
  const now = referenceDate;
  const todayISO = toISODateString(now);

  switch (period) {
    case 'current-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startISO: toISODateString(start), endISO: toISODateString(end) };
    }
    case 'previous-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startISO: toISODateString(start), endISO: toISODateString(end) };
    }
    case 'last-7-days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return { startISO: toISODateString(start), endISO: todayISO };
    }
    case 'last-30-days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      return { startISO: toISODateString(start), endISO: todayISO };
    }
    case 'current-year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { startISO: toISODateString(start), endISO: toISODateString(end) };
    }
    case 'custom':
    default:
      return { startISO: todayISO, endISO: todayISO };
  }
}

/**
 * Returns the equivalent preceding date range of the same duration for comparison.
 */
export function getPreviousPeriodDateRange(range: DateRange): DateRange {
  const start = new Date(range.startISO);
  const end = new Date(range.endISO);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffDays + 1);

  return {
    startISO: toISODateString(prevStart),
    endISO: toISODateString(prevEnd),
  };
}

/**
 * Filters transactions that fall within a specified date range [startISO, endISO] inclusive.
 */
export function filterTransactionsByDateRange(
  transactions: Transaction[],
  range: DateRange
): Transaction[] {
  return transactions.filter((tx) => {
    const iso = resolveTransactionDateISO(tx);
    if (!iso) return false;
    return iso >= range.startISO && iso <= range.endISO;
  });
}

/**
 * Calculates percentage change between current and previous values.
 */
export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // Undefined percentage growth from zero
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
