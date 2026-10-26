import { useState, useEffect, useCallback, useRef } from 'react';
import { type Transaction, initialTransactions } from '@/data/mockData';
import { MAIN_ACCOUNT_ID, type Account } from '@/data/accounts';
import type { CustomCategory } from '@/hooks/useCategories';
import { resolveTransactionDateISO, toLocalISODate } from '@/data/transactionDates';
import { getTransactionRuleError, MAX_TRANSACTION_AMOUNT } from '@/data/transactionRules';
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
    ) {
      return null;
    }
    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);

    if (
      Object.prototype.hasOwnProperty.call(item, 'categoryId') &&
      item.categoryId !== null &&
      (typeof item.categoryId !== 'string' || item.categoryId.length > 128)
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
    if (categoryName.length > 160 || (typeof item.title === 'string' && item.title.length > 160) ||
      (typeof item.dateISO === 'string' && item.dateISO.length > 10) || item.date.length > 80 ||
      (typeof item.categoryIconName === 'string' && item.categoryIconName.length > 100)) return null;

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
  /** Defaults to the stable main account when the caller does not supply one. */
  accountId?: string;
}

export interface TransferInput {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
}

type TransactionUpdateInput = Partial<Pick<TransactionInput, 'amount' | 'categoryId' | 'isIncome' | 'accountId'>>;

function buildUpdatedTransaction(
  transaction: Transaction,
  updates: TransactionUpdateInput,
  categories: readonly CustomCategory[],
  accounts: readonly Account[],
): Transaction | null {
  if (transaction.isTransfer) return null;

  const amount = updates.amount ?? transaction.amount;
  const isIncome = updates.isIncome ?? transaction.isIncome;
  const nextCategoryId = updates.categoryId === undefined ? transaction.categoryId : updates.categoryId;
  const categoryWasRequested = updates.categoryId !== undefined;
  const selectedCategory = nextCategoryId
    ? categories.find((category) => category.id === nextCategoryId)
    : undefined;

  if (categoryWasRequested && (!selectedCategory || (selectedCategory.isArchived && selectedCategory.id !== transaction.categoryId))) {
    return null;
  }
  if (selectedCategory && selectedCategory.isIncome !== isIncome) return null;
  if (updates.isIncome !== undefined && !categoryWasRequested && updates.isIncome !== transaction.isIncome) return null;

  const currentAccountId = transaction.accountId?.trim() || MAIN_ACCOUNT_ID;
  const nextAccountId = updates.accountId === undefined
    ? currentAccountId
    : (updates.accountId.trim() || currentAccountId);
  const currentAccount = accounts.find((account) => account.id === currentAccountId);
  const nextAccount = accounts.find((account) => account.id === nextAccountId);

  if (!currentAccount || !nextAccount) return null;
  const ruleError = getTransactionRuleError(
    { amount, accountId: nextAccountId, isIncome, isTransfer: false },
    accounts,
    { requireActiveAccounts: true, allowArchivedAccountId: currentAccountId },
  );
  if (ruleError) return null;
  if (currentAccount.currency.toUpperCase() !== nextAccount.currency.toUpperCase()) return null;

  return {
    ...transaction,
    amount,
    categoryId: nextCategoryId,
    category: selectedCategory?.name ?? transaction.category,
    categoryIconName: selectedCategory?.iconName ?? transaction.categoryIconName,
    title: selectedCategory?.name ?? transaction.title,
    isIncome,
    accountId: nextAccountId,
  };
}

export function useTransactions(
  categories: CustomCategory[],
  dependenciesHealthy = true
) {
  const [record, setRecord] = useState(() => loadTransactions(categories));
  const recordRef = useRef(record);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const transactions = record.value;

  const commitRecord = useCallback((next: StorageReadResult<Transaction[]>): boolean => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    recordRef.current = next;
    setRecord(next);
    return true;
  }, [dependenciesHealthy]);

  useEffect(() => {
    recordRef.current = record;
    if (!dependenciesHealthy || !canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record, dependenciesHealthy]);

  const addTransaction = useCallback((input: TransactionInput, availableAccounts: readonly Account[]): boolean => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    const accountId = input.accountId?.trim() || MAIN_ACCOUNT_ID;
    if (getTransactionRuleError({ amount: input.amount, accountId, isIncome: input.isIncome, isTransfer: false }, availableAccounts, { requireActiveAccounts: true })) return false;
    const selectedCategory = categories.find((category) => category.id === input.categoryId);
    if (!selectedCategory || selectedCategory.isArchived || selectedCategory.isIncome !== input.isIncome) return false;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;
    const newTx: Transaction = {
      id: getAvailableTransactionId(Date.now(), current.value),
      title: selectedCategory.name,
      categoryId: selectedCategory.id,
      category: selectedCategory.name,
      categoryIconName: selectedCategory.iconName,
      amount: input.amount,
      date: dateStr,
      dateISO: toLocalISODate(now),
      accountId,
      isIncome: input.isIncome,
    };

    return commitRecord({ ...current, value: [newTx, ...current.value] });
  }, [categories, commitRecord, dependenciesHealthy]);

  const addTransfer = useCallback((input: TransferInput, availableAccounts: readonly Account[]): boolean => {
    const amount = input.amount;
    const fromAccountId = input.fromAccountId.trim();
    const toAccountId = input.toAccountId.trim();
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    if (getTransactionRuleError({ amount, accountId: fromAccountId, toAccountId, isIncome: false, isTransfer: true }, availableAccounts, { requireActiveAccounts: true })) return false;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;
    const transfer: Transaction = {
      id: getAvailableTransactionId(Date.now(), current.value),
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

    return commitRecord({ ...current, value: [transfer, ...current.value] });
  }, [commitRecord, dependenciesHealthy]);

  const resetTransactions = useCallback(() => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return;
    commitRecord({ ...current, value: [] });
  }, [commitRecord, dependenciesHealthy]);

  const updateTransaction = useCallback((id: number, updates: TransactionUpdateInput, availableAccounts: readonly Account[]): boolean => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    const existing = current.value.find((transaction) => transaction.id === id);
    if (!existing) return false;
    const candidate = buildUpdatedTransaction(existing, updates, categories, availableAccounts);
    if (!candidate) return false;
    return commitRecord({
      ...current,
      value: current.value.map((transaction) => transaction.id === id ? candidate : transaction),
    });
  }, [categories, commitRecord, dependenciesHealthy]);

  const deleteTransaction = useCallback((id: number) => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status) || !current.value.some((tx) => tx.id === id)) return;
    commitRecord({ ...current, value: current.value.filter((tx) => tx.id !== id) });
  }, [commitRecord, dependenciesHealthy]);

  /**
   * Safely reconnects historical rows whose account no longer exists to the
   * permanent main account. The caller only invokes this after account storage
   * has been validated, and corrupt transaction storage remains read-only.
   */
  const reconcileAccountReferences = useCallback((validAccountIds: readonly string[]) => {
    const knownIds = new Set(validAccountIds);
    if (!knownIds.has(MAIN_ACCOUNT_ID)) return;

    const previous = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return;
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
    if (changed) commitRecord({ ...previous, value: nextTransactions });
  }, [commitRecord, dependenciesHealthy]);

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
