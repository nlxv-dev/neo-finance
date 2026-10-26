import { useCallback, useEffect, useState } from 'react';
import {
  createDefaultAccounts,
  DEFAULT_ACCOUNT_CURRENCY,
  MAIN_ACCOUNT_ID,
  type Account,
  type AccountType,
  normalizeStoredAccounts,
} from '@/data/accounts';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const STORAGE_KEY = 'fintrack-accounts';

function normalizeAccountStorage(value: unknown): Account[] | null {
  const accounts = normalizeStoredAccounts(value);
  if (!accounts) return null;
  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  // The main account is the permanent destination for legacy transactions.
  if (!mainAccount || mainAccount.isArchived || mainAccount.currency !== DEFAULT_ACCOUNT_CURRENCY) return null;
  return accounts;
}

function loadAccounts(fallbackInitialBalance = 0): StorageReadResult<Account[]> {
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
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const accounts = record.value;
  const canWrite = dependenciesHealthy && canPersistReadStatus(record.status);

  useEffect(() => {
    if (!dependenciesHealthy || !canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record.value, record.status, dependenciesHealthy]);

  const addAccount = useCallback((input: AccountInput) => {
    const name = input.name.trim();
    if (!name || name.length > 80 || (input.initialBalance !== undefined && (!Number.isFinite(input.initialBalance) || Math.abs(Math.round(input.initialBalance)) > 1_000_000_000_000))) return;
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

    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      return { ...previous, value: [...previous.value, newAccount] };
    });

    return newAccount;
  }, [dependenciesHealthy]);

  const updateAccount = useCallback((id: string, updates: Partial<AccountInput>) => {
    if (updates.initialBalance !== undefined && (!Number.isFinite(updates.initialBalance) || Math.abs(Math.round(updates.initialBalance)) > 1_000_000_000_000)) return;
    if (updates.name !== undefined && updates.name.trim().length > 80) return;
    if (updates.iconName !== undefined && updates.iconName.length > 100) return;
    if (updates.color !== undefined && updates.color.length > 40) return;
    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      return {
        ...previous,
        value: previous.value.map((account) => {
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
      };
    });
  }, [dependenciesHealthy]);

  const setAccountArchived = useCallback((id: string, isArchived: boolean) => {
    // The permanent main account must remain available for legacy transactions.
    if (id === MAIN_ACCOUNT_ID && isArchived) return;
    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      return {
        ...previous,
        value: previous.value.map((account) =>
          account.id === id ? { ...account, isArchived } : account
        ),
      };
    });
  }, [dependenciesHealthy]);

  const deleteAccount = useCallback((id: string, isUsedByHistory: boolean) => {
    // The stable main bucket is never removable or archivable.
    if (id === MAIN_ACCOUNT_ID) return;
    setRecord((previous) => {
      if (!dependenciesHealthy || !canPersistReadStatus(previous.status)) return previous;
      return {
        ...previous,
        value: previous.value.flatMap((account) => {
          if (account.id !== id) return [account];
          // An account with an opening balance must not be physically removed,
          // even if it has no transaction rows yet; that would hide real money.
          return isUsedByHistory || account.initialBalance !== 0
            ? [{ ...account, isArchived: true }]
            : [];
        }),
      };
    });
  }, [dependenciesHealthy]);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return { accounts, addAccount, updateAccount, setAccountArchived, deleteAccount, storageIssues, canWrite };
}
