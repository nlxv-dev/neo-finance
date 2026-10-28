import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { areRecordArraysEqual } from '@/storage/recordEquality';
import { type Transaction, initialTransactions } from '@/data/mockData';
import { MAIN_ACCOUNT_ID, type Account } from '@/data/accounts';
import type { CustomCategory } from '@/data/categories';
import { normalizeStoredTransactions, reconcileTransactionAccountReferences } from '@/data/transactions';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistTransactions, queryDatabaseTransactions } from '@/storage/databaseStorage';
import { toLocalISODate } from '@/data/transactionDates';
import { getTransactionRuleError } from '@/data/transactionRules';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const STORAGE_KEY = STORAGE_KEYS.transactions;

/** IDs share one namespace across regular transactions and internal transfers. */
function getAvailableTransactionId(preferredId: number, transactions: readonly Transaction[]): number {
  const usedIds = new Set(transactions.map((transaction) => transaction.id));
  let id = preferredId;
  while (usedIds.has(id)) id += 1;
  return id;
}

function loadTransactions(categories: CustomCategory[]): StorageReadResult<Transaction[]> {
  const snapshot = getDatabaseBootstrapSnapshot();
  if (snapshot) return { value: snapshot.transactions, status: 'valid' };
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
  const pendingLocalWrites = useRef(0);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const liveTransactions = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseTransactions() : null,
    [],
    null,
  );
  const transactions = record.value;

  const applyLiveTransactions = useCallback((rows: Transaction[]) => {
    if (pendingLocalWrites.current > 0) return;
    const current = recordRef.current;
    if (areRecordArraysEqual(current.value, rows) && current.status === 'valid' && !current.issue) return;
    const next: StorageReadResult<Transaction[]> = { value: rows, status: 'valid' };
    recordRef.current = next;
    setRecord(next);
  }, []);

  const refreshLatestTransactions = useCallback(async () => {
    try {
      applyLiveTransactions(await queryDatabaseTransactions());
    } catch {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }
  }, [applyLiveTransactions]);

  const persistLocalTransactions = useCallback((previousRows: Transaction[], rows: Transaction[]) => {
    if (!hasDatabaseBootstrap()) return;
    pendingLocalWrites.current += 1;
    void persistTransactions(rows, previousRows).then(() => setWriteIssue(null)).catch(() => {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }).finally(() => {
      pendingLocalWrites.current = Math.max(0, pendingLocalWrites.current - 1);
      if (pendingLocalWrites.current === 0) void refreshLatestTransactions();
    });
  }, [refreshLatestTransactions]);

  // useLiveQuery makes external Dexie changes visible, but an event from a
  // previous local write must not roll back a newer optimistic action.
  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveTransactions) return;
    applyLiveTransactions(liveTransactions);
  }, [liveTransactions, applyLiveTransactions]);

  const commitRecord = useCallback((next: StorageReadResult<Transaction[]>): boolean => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    recordRef.current = next;
    setRecord(next);
    persistLocalTransactions(current.value, next.value);
    return true;
  }, [dependenciesHealthy, persistLocalTransactions]);

  useEffect(() => {
    recordRef.current = record;
    if (hasDatabaseBootstrap()) return;
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
    const previous = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return;
    const reconciled = reconcileTransactionAccountReferences(previous.value, validAccountIds);
    if (reconciled.changed) commitRecord({ ...previous, value: reconciled.transactions });
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
