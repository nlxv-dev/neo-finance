import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { Transaction } from '@/data/mockData';
import { resolveTransactionDateISO } from '@/data/transactionDates';

export interface AccountTransactionSummary {
  income: number;
  expenses: number;
  net: number;
  count: number;
}

/**
 * Keeps account-specific analytics in a pure domain utility instead of mixing
 * financial rules into JSX. Legacy rows without accountId are assigned to the
 * stable main account, just like financialMath.
 */
export function filterTransactionsForAccount(
  transactions: readonly Transaction[],
  accountId: string,
  knownAccountIds?: readonly string[],
): Transaction[] {
  const knownIds = knownAccountIds ? new Set(knownAccountIds) : null;
  return transactions.filter((transaction) => {
    const storedAccountId = transaction.accountId?.trim();
    const linkedAccountId = storedAccountId && (!knownIds || knownIds.has(storedAccountId))
      ? storedAccountId
      : MAIN_ACCOUNT_ID;
    // The same transfer row belongs to both involved account histories.
    return linkedAccountId === accountId || transaction.toAccountId?.trim() === accountId;
  });
}

export function summarizeTransactions(transactions: readonly Transaction[]): AccountTransactionSummary {
  let income = 0;
  let expenses = 0;
  let count = 0;

  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount)) continue;
    count += 1;
    if (transaction.isTransfer) continue;

    const amount = Math.round(transaction.amount);
    if (transaction.isIncome) income += amount;
    else expenses += amount;
  }

  income = Math.round(income);
  expenses = Math.round(expenses);
  return { income, expenses, net: Math.round(income - expenses), count };
}

export function summarizeAccountTransactions(
  transactions: readonly Transaction[],
  accountId: string,
  knownAccountIds?: readonly string[],
): AccountTransactionSummary {
  return summarizeTransactions(filterTransactionsForAccount(transactions, accountId, knownAccountIds));
}
/** Filters analytics to one currency without converting or summing unlike amounts.
 * Legacy rows and orphaned account references follow the same main-account fallback
 * used by financialMath until the safe-storage reconciliation effect runs.
 */
export function filterTransactionsForCurrency(
  transactions: readonly Transaction[],
  accounts: readonly { id: string; currency: string }[],
  currency = 'RUB',
): Transaction[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const targetCurrency = currency.trim().toUpperCase() || 'RUB';

  return transactions.filter((transaction) => {
    const storedAccountId = transaction.accountId?.trim() || MAIN_ACCOUNT_ID;
    const account = accountById.get(storedAccountId);
    // An unknown ID is treated as the primary legacy bucket for now.
    return (account?.currency ?? 'RUB').toUpperCase() === targetCurrency;
  });
}

export function getOtherCurrencyCodes(
  accounts: readonly { currency: string }[],
  baseCurrency = 'RUB',
): string[] {
  const baseCode = baseCurrency.trim().toUpperCase() || 'RUB';
  return [...new Set(
    accounts
      .map((account) => account.currency.trim().toUpperCase())
      .filter((currency) => currency && currency !== baseCode),
  )].sort();
}


/**
 * Net movement for one account during a calendar month, used by the dashboard
 * balance cards. Unlike income/expense analytics, this intentionally includes
 * internal transfers: outgoing transfers decrease the source card and incoming
 * transfers increase the destination card. Opening balance is not part of this
 * value because it is not activity that happened during the selected month.
 */
export function calculateAccountMonthlyMovement(
  transactions: readonly Transaction[],
  accountId: string,
  monthKey: string,
  knownAccountIds?: readonly string[],
): number {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return 0;

  const knownIds = knownAccountIds ? new Set(knownAccountIds) : null;
  let movement = 0;

  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount)) continue;
    const dateISO = resolveTransactionDateISO(transaction);
    if (!dateISO?.startsWith(`${monthKey}-`)) continue;

    const rawSourceId = transaction.accountId?.trim();
    const sourceId = rawSourceId && (!knownIds || knownIds.has(rawSourceId))
      ? rawSourceId
      : MAIN_ACCOUNT_ID;

    if (transaction.isTransfer) {
      const rawDestinationId = transaction.toAccountId?.trim();
      const destinationId = rawDestinationId && (!knownIds || knownIds.has(rawDestinationId))
        ? rawDestinationId
        : MAIN_ACCOUNT_ID;
      if (sourceId === accountId) movement -= Math.round(transaction.amount);
      if (destinationId === accountId) movement += Math.round(transaction.amount);
      continue;
    }

    if (sourceId !== accountId) continue;
    movement += transaction.isIncome ? Math.round(transaction.amount) : -Math.round(transaction.amount);
  }

  return Math.round(movement);
}
