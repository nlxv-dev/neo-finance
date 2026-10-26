import { useState, useEffect, useCallback } from 'react';
import { type Transaction, initialTransactions } from '@/data/mockData';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { CustomCategory } from '@/hooks/useCategories';
import { resolveTransactionDateISO, toLocalISODate } from '@/data/transactionDates';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const STORAGE_KEY = 'fintrack-transactions';

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

/** IDs share one namespace across regular transactions and internal transfers. */
function getAvailableTransactionId(preferredId: number, transactions: readonly Transaction[]): number {
  const usedIds = new Set(transactions.map((transaction) => transaction.id));
  let id = preferredId;
  while (usedIds.has(id)) id += 1;
  return id;
}

/**
 * Normalizes the known legacy transaction shapes. If any row is structurally invalid,
 * return null for the whole dataset so the caller can preserve the original JSON instead
 * of silently dropping that row and saving a truncated transaction list.
 */
function normalizeStoredTransactions(value: unknown, categories: CustomCategory[]): Transaction[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: Transaction[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const item = candidate as StoredTransaction;

    if (
      typeof item.id !== 'number' ||
      !Number.isFinite(item.id) ||
      typeof item.amount !== 'number' ||
      !Number.isFinite(item.amount) ||
      typeof item.date !== 'string' ||
      typeof item.isIncome !== 'boolean'
    ) {
      return null;
    }

    if (
      Object.prototype.hasOwnProperty.call(item, 'categoryId') &&
      item.categoryId !== null &&
      typeof item.categoryId !== 'string'
    ) {
      return null;
    }

    if (
      Object.prototype.hasOwnProperty.call(item, 'accountId') &&
      item.accountId !== null &&
      typeof item.accountId !== 'string'
    ) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'isTransfer') && typeof item.isTransfer !== 'boolean') {
      return null;
    }
    if (
      Object.prototype.hasOwnProperty.call(item, 'toAccountId') &&
      item.toAccountId !== null &&
      typeof item.toAccountId !== 'string'
    ) {
      return null;
    }

    const categoryName =
      typeof item.category === 'string'
        ? item.category
        : typeof item.title === 'string'
          ? item.title
          : 'Без категории';

    const hasCategoryIdField = Object.prototype.hasOwnProperty.call(item, 'categoryId');
    const existingId = typeof item.categoryId === 'string' ? item.categoryId : null;
    let linkedCategory: CustomCategory | undefined;

    if (existingId) {
      linkedCategory = categories.find((category) => category.id === existingId);
    } else if (!hasCategoryIdField) {
      // Legacy entries stored only a name. Migrate only if the match is unambiguous.
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
    if (isTransfer && (!toAccountId || toAccountId === accountId || item.amount <= 0 || item.isIncome)) return null;

    normalized.push({
      id: item.id,
      title: typeof item.title === 'string' ? (linkedCategory?.name ?? item.title) : displayName,
      categoryId: safeId,
      category: displayName,
      categoryIconName: iconName,
      amount: item.amount,
      date: item.date,
      dateISO: resolveTransactionDateISO({
        id: item.id,
        date: item.date,
        dateISO: typeof item.dateISO === 'string' ? item.dateISO : undefined,
      }),
      // One-time, backward-compatible row migration: historic entries belong to the main account.
      accountId,
      isIncome: isTransfer ? false : item.isIncome,
      ...(isTransfer ? { isTransfer: true, toAccountId } : {}),
    });
  }

  return normalized;
}

function loadTransactions(categories: CustomCategory[]): StorageReadResult<Transaction[]> {
  return readStoredJson(STORAGE_KEY, initialTransactions, (value) => normalizeStoredTransactions(value, categories));
}

export interface TransactionInput {
  amount: number;
  categoryId: string;
  isIncome: boolean;
  /** Defaults to the stable main account until account selection is available in the UI. */
  accountId?: string;
}

export interface TransferInput {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
}

type TransactionUpdateInput = Partial<Pick<TransactionInput, 'amount' | 'categoryId' | 'isIncome' | 'accountId'>>;

export function useTransactions(
  categories: CustomCategory[],
  dependenciesHealthy = true
) {
  const [record, setRecord] = useState(() => loadTransactions(categories));
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const transactions = record.value;

  useEffect(() => {
    if (!dependenciesHealthy || !canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record.value, record.status, dependenciesHealthy]);

  const addTransaction = useCallback((input: TransactionInput) => {
    const selectedCategory = categories.find((category) => category.id === input.categoryId);
    if (!selectedCategory || selectedCategory.isArchived || selectedCategory.isIncome !== input.isIncome) return;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;

    const newTx: Transaction = {
      id: Date.now(),
      title: selectedCategory.name,
      categoryId: selectedCategory.id,
      category: selectedCategory.name,
      categoryIconName: selectedCategory.iconName,
      amount: input.amount,
      date: dateStr,
      dateISO: toLocalISODate(now),
      accountId: input.accountId?.trim() || MAIN_ACCOUNT_ID,
      isIncome: input.isIncome,
    };

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      const id = getAvailableTransactionId(newTx.id, prev.value);
      return { ...prev, value: [{ ...newTx, id }, ...prev.value] };
    });
  }, [categories, dependenciesHealthy]);

  const addTransfer = useCallback((input: TransferInput) => {
    const amount = Math.round(input.amount);
    const fromAccountId = input.fromAccountId.trim();
    const toAccountId = input.toAccountId.trim();
    if (
      !Number.isSafeInteger(amount) || amount <= 0 ||
      !fromAccountId || !toAccountId || fromAccountId === toAccountId
    ) return;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;
    // The update function checks IDs against the latest state, so two updates
    // batched in the same millisecond still receive distinct identifiers.
    const preferredId = Date.now();
    const transfer: Transaction = {
      id: preferredId,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount,
      date: dateStr,
      dateISO: toLocalISODate(now),
      accountId: fromAccountId,
      toAccountId,
      isIncome: false,
      isTransfer: true,
    };

    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      const id = getAvailableTransactionId(transfer.id, previous.value);
      return { ...previous, value: [{ ...transfer, id }, ...previous.value] };
    });
  }, [dependenciesHealthy]);

  const resetTransactions = useCallback(() => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [] };
    });
  }, [dependenciesHealthy]);

  const updateTransaction = useCallback((id: number, updates: TransactionUpdateInput) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((tx) => {
          if (tx.id !== id) return tx;

          const nextCategoryId = updates.categoryId ?? tx.categoryId;
          const selectedCategory = nextCategoryId
            ? categories.find((category) => category.id === nextCategoryId)
            : undefined;

          if (tx.isTransfer) return tx;

          return {
            ...tx,
            amount: updates.amount ?? tx.amount,
            categoryId: nextCategoryId,
            category: selectedCategory?.name ?? tx.category,
            categoryIconName: selectedCategory?.iconName ?? tx.categoryIconName,
            title: selectedCategory?.name ?? tx.title,
            isIncome: updates.isIncome ?? tx.isIncome,
            accountId: updates.accountId?.trim() || tx.accountId || MAIN_ACCOUNT_ID,
          };
        }),
      };
    });
  }, [categories, dependenciesHealthy]);

  const deleteTransaction = useCallback((id: number) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: prev.value.filter((tx) => tx.id !== id) };
    });
  }, [dependenciesHealthy]);

  /**
   * Safely reconnects historical rows whose account no longer exists to the
   * permanent main account. The caller only invokes this after account storage
   * has been validated, and corrupt transaction storage remains read-only.
   */
  const reconcileAccountReferences = useCallback((validAccountIds: readonly string[]) => {
    const knownIds = new Set(validAccountIds);
    if (!knownIds.has(MAIN_ACCOUNT_ID)) return;

    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      let changed = false;
      const nextTransactions = previous.value.map((transaction) => {
        const accountId = transaction.accountId?.trim();
        const resolvedAccountId = accountId && knownIds.has(accountId) ? accountId : MAIN_ACCOUNT_ID;
        if (transaction.isTransfer) {
          const toAccountId = transaction.toAccountId?.trim();
          const resolvedToAccountId = toAccountId && knownIds.has(toAccountId) ? toAccountId : MAIN_ACCOUNT_ID;
          // If both unknown endpoints collapse to the same fallback account, keep
          // the original record unchanged rather than persisting an invalid
          // self-transfer. Balance math treats that unresolved movement as net zero.
          if (resolvedAccountId === resolvedToAccountId && accountId !== toAccountId) return transaction;
          if (resolvedAccountId === accountId && resolvedToAccountId === toAccountId) return transaction;
          changed = true;
          return { ...transaction, accountId: resolvedAccountId, toAccountId: resolvedToAccountId };
        }
        if (resolvedAccountId === accountId) return transaction;
        changed = true;
        return { ...transaction, accountId: resolvedAccountId };
      });
      return changed ? { ...previous, value: nextTransactions } : previous;
    });
  }, [dependenciesHealthy]);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  // Transaction history owns transaction state only. The single canonical
  // balance is derived from accounts + transactions in financialMath.
  return {
    transactions,
    addTransaction,
    addTransfer,
    resetTransactions,
    updateTransaction,
    deleteTransaction,
    reconcileAccountReferences,
    storageIssues,
  };
}
