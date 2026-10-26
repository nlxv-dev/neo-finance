import { MAIN_ACCOUNT_ID, type Account } from '@/data/accounts';

export const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;

export interface TransactionFlowLike {
  amount: unknown;
  accountId?: unknown;
  isIncome: unknown;
  isTransfer?: unknown;
  toAccountId?: unknown;
}

export interface TransactionRuleOptions {
  /** New operations should use active accounts. Historical records may reference archived accounts. */
  requireActiveAccounts?: boolean;
  /** Permit editing an existing operation without moving it away from its already-archived account. */
  allowArchivedAccountId?: string;
}

/**
 * The shared financial invariant validator for transaction writes and imports.
 * UI-specific category rules are checked by the transaction hook; this function
 * owns amounts, account references, transfer shape, archive policy and currency.
 */
export function getTransactionRuleError(
  transaction: TransactionFlowLike,
  accounts: readonly Pick<Account, 'id' | 'currency' | 'isArchived'>[],
  options: TransactionRuleOptions = {},
): string | null {
  if (typeof transaction.amount !== 'number' || !Number.isSafeInteger(transaction.amount) || transaction.amount <= 0 || transaction.amount > MAX_TRANSACTION_AMOUNT) {
    return 'Сумма операции должна быть положительным целым числом рублей не более 1 000 000 000 000.';
  }
  if (typeof transaction.isIncome !== 'boolean') return 'Не удалось определить тип операции.';
  if (transaction.isTransfer !== undefined && typeof transaction.isTransfer !== 'boolean') {
    return 'Не удалось определить тип перевода.';
  }
  if (transaction.toAccountId !== undefined && transaction.toAccountId !== null && typeof transaction.toAccountId !== 'string') {
    return 'Счёт назначения указан неверно.';
  }

  const accountId = typeof transaction.accountId === 'string' && transaction.accountId.trim()
    ? transaction.accountId.trim()
    : MAIN_ACCOUNT_ID;
  if (accountId.length > 128) return 'Идентификатор счёта слишком длинный.';
  const source = accounts.find((account) => account.id === accountId);
  if (!source) return 'Выбранный счёт не существует.';
  if (options.requireActiveAccounts && source.isArchived && source.id !== options.allowArchivedAccountId) {
    return 'Нельзя создавать операции на архивном счёте.';
  }

  const isTransfer = transaction.isTransfer === true;
  const toAccountId = typeof transaction.toAccountId === 'string' ? transaction.toAccountId.trim() : '';
  if (!isTransfer) {
    if (toAccountId) return 'У обычной операции не может быть счёта назначения.';
    return null;
  }

  if (transaction.isIncome) return 'Внутренний перевод не может считаться доходом.';
  if (!toAccountId || toAccountId.length > 128) return 'Укажите корректный счёт назначения.';
  if (accountId === toAccountId) return 'Счёт отправителя и получателя должны отличаться.';

  const destination = accounts.find((account) => account.id === toAccountId);
  if (!destination) return 'Счёт назначения не существует.';
  if (options.requireActiveAccounts && destination.isArchived) return 'Нельзя переводить деньги на архивный счёт.';
  if (source.currency.toUpperCase() !== destination.currency.toUpperCase()) {
    return 'Переводы между разными валютами пока не поддерживаются.';
  }
  return null;
}
