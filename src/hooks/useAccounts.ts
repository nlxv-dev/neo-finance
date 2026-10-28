import { useCallback, useEffect, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { areRecordArraysEqual } from '@/storage/recordEquality';
import {
  createDefaultAccounts,
  DEFAULT_ACCOUNT_CURRENCY,
  MAIN_ACCOUNT_ID,
  type Account,
  type AccountType,
  normalizeStoredAccounts,
} from '@/data/accounts';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistAccounts, queryDatabaseAccounts } from '@/storage/databaseStorage';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const STORAGE_KEY = STORAGE_KEYS.accounts;

function normalizeAccountStorage(value: unknown): Account[] | null {
  const accounts = normalizeStoredAccounts(value);
  if (!accounts) return null;
  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  // The main account is the permanent destination for legacy transactions.
  if (!mainAccount || mainAccount.isArchived || mainAccount.currency !== DEFAULT_ACCOUNT_CURRENCY) return null;
  return accounts;
}

function loadAccounts(fallbackInitialBalance = 0): StorageReadResult<Account[]> {
  const snapshot = getDatabaseBootstrapSnapshot();
  if (snapshot) return { value: snapshot.accounts, status: 'valid' };
  return readStoredJson(STORAGE_KEY, createDefaultAccounts(fallbackInitialBalance), normalizeAccountStorage);
}

function createAccountId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `acc-${crypto.randomUUID()}`;
  }
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  iconName: string;
  initialBalance?: number;
  color?: string;
}

/**
 * Safe-storage hook for accounts. When the account key is missing, the single
 * main account is initialized from the historical profile opening balance.
 * The app then treats account records as the canonical balance source.
 */
export function useAccounts(fallbackInitialBalance = 0, dependenciesHealthy = true) {
  const [record, setRecord] = useState(() => loadAccounts(fallbackInitialBalance));
  const recordRef = useRef(record);
  const pendingLocalWrites = useRef(0);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const liveAccounts = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseAccounts() : null,
    [],
    null,
  );
  const accounts = record.value;
  const canWrite = dependenciesHealthy && canPersistReadStatus(record.status);

  const applyLiveAccounts = useCallback((rows: Account[]) => {
    if (pendingLocalWrites.current > 0) return;
    const current = recordRef.current;
    if (areRecordArraysEqual(current.value, rows) && current.status === 'valid' && !current.issue) return;
    const next: StorageReadResult<Account[]> = { value: rows, status: 'valid' };
    recordRef.current = next;
    setRecord(next);
  }, []);

  const refreshLatestAccounts = useCallback(async () => {
    try {
      applyLiveAccounts(await queryDatabaseAccounts());
    } catch {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }
  }, [applyLiveAccounts]);

  const persistLocalAccounts = useCallback((previousRows: Account[], rows: Account[]) => {
    if (!hasDatabaseBootstrap()) return;
    pendingLocalWrites.current += 1;
    void persistAccounts(rows, previousRows).then(() => setWriteIssue(null)).catch(() => {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }).finally(() => {
      pendingLocalWrites.current = Math.max(0, pendingLocalWrites.current - 1);
      if (pendingLocalWrites.current === 0) void refreshLatestAccounts();
    });
  }, [refreshLatestAccounts]);

  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveAccounts) return;
    applyLiveAccounts(liveAccounts);
  }, [liveAccounts, applyLiveAccounts]);

  const commit = useCallback((next: StorageReadResult<Account[]>): boolean => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return false;
    recordRef.current = next;
    setRecord(next);
    persistLocalAccounts(current.value, next.value);
    return true;
  }, [dependenciesHealthy, persistLocalAccounts]);

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

  const addAccount = useCallback((input: AccountInput) => {
    const name = input.name.trim();
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status) || !name || name.length > 80 || (input.initialBalance !== undefined && (!Number.isFinite(input.initialBalance) || Math.abs(Math.round(input.initialBalance)) > 1_000_000_000_000))) return;
    if (input.iconName.length > 100 || (input.color !== undefined && input.color.length > 40)) return;

    const newAccount: Account = {
      id: createAccountId(),
      name,
      type: input.type,
      iconName: input.iconName.trim() || 'CreditCard',
      currency: DEFAULT_ACCOUNT_CURRENCY,
      initialBalance: Math.round(input.initialBalance ?? 0),
      isArchived: false,
      color: input.color,
    };
    if (!commit({ ...current, value: [...current.value, newAccount] })) return;
    return newAccount;
  }, [commit, dependenciesHealthy]);

  const updateAccount = useCallback((id: string, updates: Partial<AccountInput>) => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return;
    if (updates.initialBalance !== undefined && (!Number.isFinite(updates.initialBalance) || Math.abs(Math.round(updates.initialBalance)) > 1_000_000_000_000)) return;
    if (updates.name !== undefined && updates.name.trim().length > 80) return;
    if (updates.iconName !== undefined && updates.iconName.length > 100) return;
    if (updates.color !== undefined && updates.color.length > 40) return;
    if (!current.value.some((account) => account.id === id)) return;
    commit({
      ...current,
      value: current.value.map((account) => {
        if (account.id !== id) return account;
        return {
          ...account,
          name: updates.name !== undefined ? updates.name.trim() || account.name : account.name,
          type: updates.type ?? account.type,
          iconName: updates.iconName?.trim() || account.iconName,
          initialBalance: updates.initialBalance !== undefined
            ? Math.round(updates.initialBalance)
            : account.initialBalance,
          color: updates.color !== undefined ? updates.color : account.color,
        };
      }),
    });
  }, [commit, dependenciesHealthy]);

  const setAccountArchived = useCallback((id: string, isArchived: boolean) => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return;
    // The permanent main account must remain available for legacy transactions.
    if (id === MAIN_ACCOUNT_ID && isArchived) return;
    if (!current.value.some((account) => account.id === id)) return;
    commit({
      ...current,
      value: current.value.map((account) =>
        account.id === id ? { ...account, isArchived } : account
      ),
    });
  }, [commit, dependenciesHealthy]);

  const deleteAccount = useCallback((id: string, isUsedByHistory: boolean) => {
    const current = recordRef.current;
    if (!dependenciesHealthy || !canPersistReadStatus(current.status)) return;
    // The stable main bucket is never removable or archivable.
    if (id === MAIN_ACCOUNT_ID) return;
    if (!current.value.some((account) => account.id === id)) return;
    commit({
      ...current,
      value: current.value.flatMap((account) => {
        if (account.id !== id) return [account];
        // An account with an opening balance must not be physically removed,
        // even if it has no transaction rows yet; that would hide real money.
        return isUsedByHistory || account.initialBalance !== 0
          ? [{ ...account, isArchived: true }]
          : [];
      }),
    });
  }, [commit, dependenciesHealthy]);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return { accounts, addAccount, updateAccount, setAccountArchived, deleteAccount, storageIssues, canWrite };
}
