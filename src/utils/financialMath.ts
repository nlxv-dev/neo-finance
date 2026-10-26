import {
  DEFAULT_ACCOUNT_CURRENCY,
  createDefaultAccounts,
  MAIN_ACCOUNT_ID,
  type Account,
} from '@/data/accounts';

/** The subset of transaction data needed for account-level balance math. */
export interface AccountTransaction {
  amount: number;
  isIncome: boolean;
  /** Missing/empty IDs are legacy transactions and belong to the primary account. */
  accountId?: string | null;
  /** Internal movement. accountId is the source and toAccountId is the destination. */
  isTransfer?: boolean;
  toAccountId?: string | null;
}

export type AccountAssignedTransaction<T extends AccountTransaction> = Omit<T, 'accountId'> & {
  accountId: string;
};

export interface LegacyFinanceMigration<T extends AccountTransaction> {
  accounts: Account[];
  transactions: AccountAssignedTransaction<T>[];
}

/**
 * Deterministic, non-mutating migration for a first launch of account support.
 * Call only when the account storage key is missing, never when accounts already
 * exist. Opening balance remains the legacy profile's initialBalance; legacy
 * transaction rows are assigned to acc-main exactly once by the caller.
 */
export function migrateLegacyFinanceToAccounts<T extends AccountTransaction>(
  legacyInitialBalance: number,
  legacyTransactions: readonly T[],
): LegacyFinanceMigration<T> {
  return {
    accounts: createDefaultAccounts(legacyInitialBalance),
    transactions: legacyTransactions.map((transaction) => ({
      ...transaction,
      accountId: transaction.accountId?.trim() || MAIN_ACCOUNT_ID,
    })),
  };
}

/** Normalize whole-unit money values and prevent NaN/Infinity leaking into totals. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * Selects the stable legacy bucket. The main account remains the default target
 * for old or unassigned transactions, including while other accounts are archived.
 */
export function getPrimaryAccountId(accounts: readonly Account[]): string {
  if (accounts.some((account) => account.id === MAIN_ACCOUNT_ID)) return MAIN_ACCOUNT_ID;
  return accounts[0]?.id ?? MAIN_ACCOUNT_ID;
}

/**
 * Calculates an account balance from its opening balance plus assigned
 * transactions. Archived accounts are calculated exactly like active accounts.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: readonly AccountTransaction[],
  primaryAccountId = MAIN_ACCOUNT_ID,
): number {
  let balance = roundMoney(account.initialBalance);

  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount)) continue;

    const transactionAccountId = transaction.accountId?.trim();
    const belongsToAccount = transactionAccountId
      ? transactionAccountId === account.id
      : account.id === primaryAccountId;

    const amount = roundMoney(transaction.amount);
    if (transaction.isTransfer) {
      // One stored transfer row moves value from the source to the destination.
      // It must not be represented as an expense plus a separate income row.
      if (belongsToAccount) balance -= amount;
      if (transaction.toAccountId?.trim() === account.id) balance += amount;
      continue;
    }

    if (!belongsToAccount) continue;
    balance += transaction.isIncome ? amount : -amount;
  }

  return roundMoney(balance);
}

/** Calculates a balance for every account, including archived accounts. */
export function calculateAllAccountBalances(
  accounts: readonly Account[],
  transactions: readonly AccountTransaction[],
): Record<string, number> {
  const primaryAccountId = getPrimaryAccountId(accounts);
  const accountIds = new Set(accounts.map((account) => account.id));
  const reconciledTransactions = transactions.map((transaction) => {
    const accountId = transaction.accountId?.trim();
    const resolvedAccountId = accountId && accountIds.has(accountId) ? accountId : primaryAccountId;
    if (transaction.isTransfer) {
      const toAccountId = transaction.toAccountId?.trim();
      const resolvedToAccountId = toAccountId && accountIds.has(toAccountId) ? toAccountId : primaryAccountId;
      return resolvedAccountId === accountId && resolvedToAccountId === toAccountId
        ? transaction
        : { ...transaction, accountId: resolvedAccountId, toAccountId: resolvedToAccountId };
    }
    // Never let an orphaned account reference make a transaction disappear from
    // the user's total. Until it can be resolved, keep it in the stable main bucket.
    return resolvedAccountId === accountId ? transaction : { ...transaction, accountId: resolvedAccountId };
  });
  const balances: Record<string, number> = {};

  for (const account of accounts) {
    balances[account.id] = calculateAccountBalance(account, reconciledTransactions, primaryAccountId);
  }

  return balances;
}

/**
 * Returns total balances grouped by currency. Never adds RUB, USD, EUR, etc.
 * together without an explicit exchange-rate conversion.
 *
 * The legacy fallback is attributed to RUB because the original Neo Finance
 * profile balance has no currency field and the app's displayed currency is RUB.
 */
export function calculateBalancesByCurrency(
  accounts: readonly Account[],
  transactions: readonly AccountTransaction[],
  fallbackInitialBalance = 0,
): Record<string, number> {
  if (accounts.length === 0) {
    const income = transactions.reduce(
      (sum, transaction) => sum + (!transaction.isTransfer && transaction.isIncome ? roundMoney(transaction.amount) : 0),
      0,
    );
    const expenses = transactions.reduce(
      (sum, transaction) => sum + (!transaction.isTransfer && !transaction.isIncome ? roundMoney(transaction.amount) : 0),
      0,
    );
    return {
      [DEFAULT_ACCOUNT_CURRENCY]: roundMoney(fallbackInitialBalance + income - expenses),
    };
  }

  const accountBalances = calculateAllAccountBalances(accounts, transactions);
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    const currency = account.currency.trim().toUpperCase() || DEFAULT_ACCOUNT_CURRENCY;
    totals[currency] = roundMoney((totals[currency] ?? 0) + (accountBalances[account.id] ?? 0));
  }
  return totals;
}

/**
 * The main dashboard balance is denominated in RUB. Other currencies remain
 * available through calculateBalancesByCurrency instead of being mixed in.
 */
export function calculateTotalBalance(
  accounts: readonly Account[],
  transactions: readonly AccountTransaction[],
  fallbackInitialBalance = 0,
  currency = DEFAULT_ACCOUNT_CURRENCY,
): number {
  return calculateBalancesByCurrency(accounts, transactions, fallbackInitialBalance)[currency.toUpperCase()] ?? 0;
}


/**
 * Computes the main account's opening balance needed to reach a requested RUB
 * total without modifying any other account or transaction. This keeps the
 * balance-adjustment action canonical after account storage becomes active.
 */
export function calculateMainOpeningBalanceForTargetTotal(
  accounts: readonly Account[],
  transactions: readonly AccountTransaction[],
  targetTotal: number,
  currency = DEFAULT_ACCOUNT_CURRENCY,
): number {
  const normalizedCurrency = currency.toUpperCase();
  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  if (!mainAccount || mainAccount.currency.toUpperCase() !== normalizedCurrency) {
    return roundMoney(targetTotal);
  }

  const primaryAccountId = getPrimaryAccountId(accounts);
  const accountIds = new Set(accounts.map((account) => account.id));
  let mainTransactionNet = 0;
  let otherAccountBalances = 0;

  for (const transaction of transactions) {
    const storedAccountId = transaction.accountId?.trim();
    const transactionAccountId = storedAccountId && accountIds.has(storedAccountId)
      ? storedAccountId
      : primaryAccountId;
    const storedToAccountId = transaction.toAccountId?.trim();
    const destinationAccountId = storedToAccountId && accountIds.has(storedToAccountId)
      ? storedToAccountId
      : primaryAccountId;
    if (!Number.isFinite(transaction.amount)) continue;
    const amount = roundMoney(transaction.amount);
    if (transaction.isTransfer) {
      if (transactionAccountId === MAIN_ACCOUNT_ID) mainTransactionNet -= amount;
      if (destinationAccountId === MAIN_ACCOUNT_ID) mainTransactionNet += amount;
      continue;
    }
    if (transactionAccountId === MAIN_ACCOUNT_ID) {
      mainTransactionNet += transaction.isIncome ? amount : -amount;
    }
  }

  for (const account of accounts) {
    if (account.id === MAIN_ACCOUNT_ID || account.currency.toUpperCase() !== normalizedCurrency) continue;
    otherAccountBalances += calculateAccountBalance(account, transactions, primaryAccountId);
  }

  return roundMoney(roundMoney(targetTotal) - otherAccountBalances - mainTransactionNet);
}


/**
 * Computes the opening balance needed for one selected account to reach a
 * requested current balance while preserving that account's complete history.
 * Transfers in/out are part of the account's movement; other accounts stay unchanged.
 */
export function calculateAccountOpeningBalanceForTargetBalance(
  accountId: string,
  accounts: readonly Account[],
  transactions: readonly AccountTransaction[],
  targetBalance: number,
): number {
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account || !Number.isFinite(targetBalance)) return account?.initialBalance ?? 0;
  const currentBalance = calculateAllAccountBalances(accounts, transactions)[accountId] ?? account.initialBalance;
  const historicalMovement = currentBalance - account.initialBalance;
  return roundMoney(roundMoney(targetBalance) - historicalMovement);
}
