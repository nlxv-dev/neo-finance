import { useState, useEffect, useCallback } from 'react';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';
import {
  type Account,
  type AccountType,
  DEFAULT_ACCOUNTS,
} from '@/data/accounts';

const STORAGE_KEY = 'fintrack-accounts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStoredAccounts(value: unknown): Account[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: Account[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) return null;

    if (
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.type !== 'string' ||
      typeof item.iconName !== 'string' ||
      typeof item.initialBalance !== 'number' ||
      !Number.isFinite(item.initialBalance)
    ) {
      return null;
    }

    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);

    const safeType: AccountType = ['card', 'cash', 'bank', 'savings', 'other'].includes(item.type)
      ? (item.type as AccountType)
      : 'card';

    normalized.push({
      id: item.id,
      name: item.name.trim(),
      type: safeType,
      iconName: item.iconName.trim() || 'CreditCard',
      currency: typeof item.currency === 'string' && item.currency ? item.currency : 'RUB',
      initialBalance: Math.round(item.initialBalance),
      isArchived: item.isArchived === true,
      color: typeof item.color === 'string' ? item.color : undefined,
    });
  }

  return normalized;
}

function loadAccounts(fallbackInitialBalance = 0): StorageReadResult<Account[]> {
  const defaults = DEFAULT_ACCOUNTS.map((acc, index) =>
    index === 0 ? { ...acc, initialBalance: fallbackInitialBalance } : acc
  );
  return readStoredJson(STORAGE_KEY, defaults, normalizeStoredAccounts);
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
  currency?: string;
  initialBalance?: number;
  color?: string;
}

export function useAccounts(fallbackInitialBalance = 0, dependenciesHealthy = true) {
  const [record, setRecord] = useState(() => loadAccounts(fallbackInitialBalance));
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const accounts = record.value;

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
    const trimmedName = input.name.trim();
    if (!trimmedName) return;

    const newAccount: Account = {
      id: createAccountId(),
      name: trimmedName,
      type: input.type,
      iconName: input.iconName || 'CreditCard',
      currency: input.currency || 'RUB',
      initialBalance: Math.round(input.initialBalance ?? 0),
      isArchived: false,
      color: input.color,
    };

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [...prev.value, newAccount] };
    });

    return newAccount;
  }, [dependenciesHealthy]);

  const updateAccount = useCallback((id: string, updates: Partial<AccountInput>) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((acc) => {
          if (acc.id !== id) return acc;
          return {
            ...acc,
            name: updates.name !== undefined ? updates.name.trim() || acc.name : acc.name,
            type: updates.type ?? acc.type,
            iconName: updates.iconName ?? acc.iconName,
            currency: updates.currency ?? acc.currency,
            initialBalance: updates.initialBalance !== undefined ? Math.round(updates.initialBalance) : acc.initialBalance,
            color: updates.color !== undefined ? updates.color : acc.color,
          };
        }),
      };
    });
  }, [dependenciesHealthy]);

  const deleteAccount = useCallback((id: string, isUsedByHistory: boolean) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      // Do not delete if it is the only non-archived account
      const activeCount = prev.value.filter((a) => !a.isArchived).length;
      if (activeCount <= 1 && prev.value.some((a) => a.id === id && !a.isArchived)) {
        return prev;
      }

      return {
        ...prev,
        value: prev.value.flatMap((acc) => {
          if (acc.id !== id) return [acc];
          if (isUsedByHistory) {
            return [{ ...acc, isArchived: true }];
          }
          return [];
        }),
      };
    });
  }, [dependenciesHealthy]);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    storageIssues,
  };
}
