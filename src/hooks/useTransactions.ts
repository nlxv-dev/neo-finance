import { useState, useEffect, useCallback } from 'react';
import { type Transaction, initialTransactions } from '@/data/mockData';
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
  toAccountId?: unknown;
  isTransfer?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

    const isTransfer = item.isTransfer === true;
    const accountId = typeof item.accountId === 'string' && item.accountId ? item.accountId : null;
    const toAccountId = typeof item.toAccountId === 'string' && item.toAccountId ? item.toAccountId : null;

    const categoryName =
      typeof item.category === 'string'
        ? item.category
        : typeof item.title === 'string'
          ? item.title
          : isTransfer
            ? 'Перевод'
            : 'Без категории';

    const hasCategoryIdField = Object.prototype.hasOwnProperty.call(item, 'categoryId');
    const existingId = typeof item.categoryId === 'string' ? item.categoryId : null;
    let linkedCategory: CustomCategory | undefined;

    if (existingId) {
      linkedCategory = categories.find((category) => category.id === existingId);
    } else if (!hasCategoryIdField && !isTransfer) {
      // Legacy entries stored only a name. Migrate only if the match is unambiguous.
      const matches = categories.filter(
        (category) =>
          !category.isArchived &&
          category.name.trim().toLocaleLowerCase('ru-RU') === categoryName.trim().toLocaleLowerCase('ru-RU') &&
          category.isIncome === item.isIncome
      );
      if (matches.length === 1) linkedCategory = matches[0];
    }

    const legacyIcon = typeof item.categoryIconName === 'string'
      ? item.categoryIconName
      : isTransfer
        ? 'ArrowLeftRight'
        : 'HelpCircle';
    const safeId = linkedCategory?.id ?? (hasCategoryIdField ? existingId : null);
    const displayName = isTransfer ? (typeof item.title === 'string' ? item.title : 'Перевод') : (linkedCategory?.name ?? categoryName);
    const iconName = isTransfer ? 'ArrowLeftRight' : (linkedCategory?.iconName ?? legacyIcon);

    normalized.push({
      id: item.id,
      title: typeof item.title === 'string' ? (isTransfer ? item.title : (linkedCategory?.name ?? item.title)) : displayName,
      categoryId: safeId,
      category: displayName,
      categoryIconName: iconName,
      amount: Math.round(item.amount),
      date: item.date,
      dateISO: resolveTransactionDateISO({
        id: item.id,
        date: item.date,
        dateISO: typeof item.dateISO === 'string' ? item.dateISO : undefined,
      }),
      isIncome: item.isIncome,
      accountId,
      toAccountId,
      isTransfer,
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
  accountId?: string | null;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fromAccountName?: string;
  toAccountName?: string;
  comment?: string;
}

export function useTransactions(
  initialBalance: number,
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
      amount: Math.round(input.amount),
      date: dateStr,
      dateISO: toLocalISODate(now),
      isIncome: input.isIncome,
      accountId: input.accountId ?? null,
      isTransfer: false,
    };

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [newTx, ...prev.value] };
    });
  }, [categories, dependenciesHealthy]);

  const addTransfer = useCallback((input: TransferInput) => {
    if (input.fromAccountId === input.toAccountId) return;
    if (!Number.isFinite(input.amount) || input.amount <= 0) return;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;

    const title = input.comment?.trim()
      ? input.comment.trim()
      : input.fromAccountName && input.toAccountName
        ? `Перевод: ${input.fromAccountName} → ${input.toAccountName}`
        : 'Перевод между счетами';

    const newTx: Transaction = {
      id: Date.now(),
      title,
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: Math.round(input.amount),
      date: dateStr,
      dateISO: toLocalISODate(now),
      isIncome: false,
      accountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      isTransfer: true,
    };

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [newTx, ...prev.value] };
    });
  }, [dependenciesHealthy]);

  const resetTransactions = useCallback(() => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [] };
    });
  }, [dependenciesHealthy]);

  const updateTransaction = useCallback((id: number, updates: Partial<TransactionInput>) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((tx) => {
          if (tx.id !== id) return tx;

          const nextCategoryId = updates.categoryId !== undefined ? updates.categoryId : tx.categoryId;
          const selectedCategory = nextCategoryId
            ? categories.find((category) => category.id === nextCategoryId)
            : undefined;

          return {
            ...tx,
            amount: updates.amount !== undefined ? Math.round(updates.amount) : tx.amount,
            categoryId: nextCategoryId,
            category: selectedCategory?.name ?? tx.category,
            categoryIconName: selectedCategory?.iconName ?? tx.categoryIconName,
            title: selectedCategory?.name ?? tx.title,
            isIncome: updates.isIncome !== undefined ? updates.isIncome : tx.isIncome,
            accountId: updates.accountId !== undefined ? updates.accountId : tx.accountId,
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

  // Income and expenses strictly EXCLUDE transfers
  const totalIncome = transactions
    .filter((transaction) => !transaction.isTransfer && transaction.isIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalExpenses = transactions
    .filter((transaction) => !transaction.isTransfer && !transaction.isIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalBalance = initialBalance + totalIncome - totalExpenses;
  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return {
    transactions,
    addTransaction,
    addTransfer,
    resetTransactions,
    updateTransaction,
    deleteTransaction,
    totalIncome,
    totalExpenses,
    totalBalance,
    storageIssues,
  };
}
