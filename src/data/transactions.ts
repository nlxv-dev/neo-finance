/**
 * Canonical legacy transaction normalization.
 * This is intentionally a pure data-layer function so both the current hook and
 * the one-time LocalStorage -> Dexie migration use identical compatibility rules.
 */
import type { Transaction } from '@/data/mockData';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { CustomCategory } from '@/data/categories';
import { resolveTransactionDateISO } from '@/data/transactionDates';
import { MAX_TRANSACTION_AMOUNT } from '@/data/transactionRules';

type StoredTransaction = Partial<Transaction> & {
  category?: unknown;
  title?: unknown;
  categoryId?: unknown;
  categoryIconName?: unknown;
  amount?: unknown;
  date?: unknown;
  isIncome?: unknown;
  id?: unknown;
  accountId?: unknown;
  isTransfer?: unknown;
  toAccountId?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Normalizes known legacy transaction shapes. If any row is invalid, returns null
 * for the whole dataset rather than silently dropping rows and truncating history.
 */
export function normalizeStoredTransactions(value: unknown, categories: CustomCategory[]): Transaction[] | null {
  if (!Array.isArray(value) || value.length > 50_000) return null;

  const normalized: Transaction[] = [];
  const seenIds = new Set<number>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const item = candidate as StoredTransaction;

    if (
      typeof item.id !== 'number' ||
      !Number.isSafeInteger(item.id) || item.id < 0 ||
      typeof item.amount !== 'number' ||
      !Number.isSafeInteger(item.amount) || item.amount <= 0 || item.amount > MAX_TRANSACTION_AMOUNT ||
      typeof item.date !== 'string' ||
      typeof item.isIncome !== 'boolean'
    ) return null;

    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);

    if (
      Object.prototype.hasOwnProperty.call(item, 'categoryId') &&
      item.categoryId !== null &&
      (typeof item.categoryId !== 'string' || item.categoryId.length > 128)
    ) return null;

    if (
      Object.prototype.hasOwnProperty.call(item, 'accountId') &&
      item.accountId !== null && typeof item.accountId !== 'string'
    ) return null;
    if (Object.prototype.hasOwnProperty.call(item, 'isTransfer') && typeof item.isTransfer !== 'boolean') return null;
    if (
      Object.prototype.hasOwnProperty.call(item, 'toAccountId') &&
      item.toAccountId !== null && typeof item.toAccountId !== 'string'
    ) return null;

    const categoryName = typeof item.category === 'string'
      ? item.category
      : typeof item.title === 'string'
        ? item.title
        : 'Без категории';

    if (
      categoryName.length > 160 ||
      (typeof item.title === 'string' && item.title.length > 160) ||
      (typeof item.dateISO === 'string' && item.dateISO.length > 10) ||
      item.date.length > 80 ||
      (typeof item.categoryIconName === 'string' && item.categoryIconName.length > 100)
    ) return null;

    const hasCategoryIdField = Object.prototype.hasOwnProperty.call(item, 'categoryId');
    const existingId = typeof item.categoryId === 'string' ? item.categoryId : null;
    let linkedCategory: CustomCategory | undefined;

    if (existingId) {
      linkedCategory = categories.find((category) => category.id === existingId);
    } else if (!hasCategoryIdField) {
      // Legacy rows stored only a name: link only when the match is unambiguous.
      const matches = categories.filter(
        (category) =>
          !category.isArchived &&
          category.name.trim().toLocaleLowerCase('ru-RU') === categoryName.trim().toLocaleLowerCase('ru-RU') &&
          category.isIncome === item.isIncome
      );
      if (matches.length === 1) linkedCategory = matches[0];
    }

    const legacyIcon = typeof item.categoryIconName === 'string' ? item.categoryIconName : 'HelpCircle';
    const safeId = linkedCategory?.id ?? (hasCategoryIdField ? existingId : null);
    const displayName = linkedCategory?.name ?? categoryName;
    const iconName = linkedCategory?.iconName ?? legacyIcon;
    const accountId = typeof item.accountId === 'string' && item.accountId.trim()
      ? item.accountId.trim()
      : MAIN_ACCOUNT_ID;
    const isTransfer = item.isTransfer === true;
    const toAccountId = typeof item.toAccountId === 'string' ? item.toAccountId.trim() : '';

    if (accountId.length > 128 || toAccountId.length > 128) return null;
    if (isTransfer && (!toAccountId || toAccountId === accountId || item.amount <= 0 || item.isIncome)) return null;
    if (!isTransfer && toAccountId) return null;

    normalized.push({
      id: item.id,
      title: isTransfer ? 'Перевод между счетами' : (typeof item.title === 'string' ? (linkedCategory?.name ?? item.title) : displayName),
      categoryId: isTransfer ? null : safeId,
      category: isTransfer ? 'Перевод' : displayName,
      categoryIconName: isTransfer ? 'ArrowLeftRight' : iconName,
      amount: item.amount,
      date: item.date,
      dateISO: resolveTransactionDateISO({
        id: item.id,
        date: item.date,
        dateISO: typeof item.dateISO === 'string' ? item.dateISO : undefined,
      }),
      // Historic entries without an account belong to the stable main account.
      accountId,
      isIncome: isTransfer ? false : item.isIncome,
      ...(isTransfer ? { isTransfer: true, toAccountId } : {}),
    });
  }

  return normalized;
}


export interface ReconciledTransactionAccounts {
  transactions: Transaction[];
  unresolvedTransferIds: number[];
  changed: boolean;
}

/**
 * Reproduces the app's established fallback behavior for dangling account links.
 * An unresolved transfer whose endpoints collapse to one account is preserved
 * unchanged and reported, rather than being rewritten into a self-transfer.
 */
export function reconcileTransactionAccountReferences(
  transactions: readonly Transaction[],
  validAccountIds: readonly string[],
): ReconciledTransactionAccounts {
  const knownIds = new Set(validAccountIds);
  if (!knownIds.has('acc-main')) {
    return { transactions: [...transactions], unresolvedTransferIds: [], changed: false };
  }

  let changed = false;
  const unresolvedTransferIds: number[] = [];
  const normalized = transactions.map((transaction) => {
    const oldAccountId = transaction.accountId?.trim();
    const accountId = oldAccountId && knownIds.has(oldAccountId) ? oldAccountId : 'acc-main';

    if (transaction.isTransfer) {
      const oldToAccountId = transaction.toAccountId?.trim();
      const toAccountId = oldToAccountId && knownIds.has(oldToAccountId) ? oldToAccountId : 'acc-main';
      if (accountId === toAccountId && oldAccountId !== oldToAccountId) {
        unresolvedTransferIds.push(transaction.id);
        return transaction;
      }
      if (accountId === oldAccountId && toAccountId === oldToAccountId) return transaction;
      changed = true;
      return { ...transaction, accountId, toAccountId };
    }

    if (accountId === oldAccountId) return transaction;
    changed = true;
    return { ...transaction, accountId };
  });

  return { transactions: normalized, unresolvedTransferIds, changed };
}
