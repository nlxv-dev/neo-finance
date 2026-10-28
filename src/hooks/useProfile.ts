import { useState, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistProfile, queryDatabaseProfile } from '@/storage/databaseStorage';
import {
  canPersistReadStatus,
  readStoredNumber,
  readStoredString,
  writeStoredRawValue,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const NAME_KEY = STORAGE_KEYS.userName;
const BALANCE_KEY = STORAGE_KEYS.initialBalance;
const MONTHLY_BUDGET_KEY = STORAGE_KEYS.monthlyBudget;

const DEFAULT_NAME = 'Пользователь';
const DEFAULT_BALANCE = 0;
const DEFAULT_MONTHLY_BUDGET = 50_000;
const MAX_MONEY_AMOUNT = 1_000_000_000_000;

export function useProfile() {
  const [nameRecord, setNameRecord] = useState<StorageReadResult<string>>(() => {
    const snapshot = getDatabaseBootstrapSnapshot();
    return snapshot ? { value: snapshot.profile.userName, status: 'valid' as const } : readStoredString(NAME_KEY, DEFAULT_NAME);
  });
  const [balanceRecord, setBalanceRecord] = useState<StorageReadResult<number>>(() => {
    const snapshot = getDatabaseBootstrapSnapshot();
    return snapshot
      ? { value: snapshot.profile.initialBalance, status: 'valid' as const }
      : readStoredNumber(BALANCE_KEY, DEFAULT_BALANCE, (value) => Math.abs(value) <= MAX_MONEY_AMOUNT);
  });
  const [budgetRecord, setBudgetRecord] = useState<StorageReadResult<number>>(() => {
    const snapshot = getDatabaseBootstrapSnapshot();
    return snapshot
      ? { value: snapshot.profile.monthlyBudget, status: 'valid' as const }
      : readStoredNumber(MONTHLY_BUDGET_KEY, DEFAULT_MONTHLY_BUDGET, (value) => value > 0 && value <= MAX_MONEY_AMOUNT);
  });
  const [writeIssues, setWriteIssues] = useState<StorageIssue[]>([]);
  const didInitializePersistence = useRef(false);
  const liveProfile = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseProfile() : null,
    [],
    null,
  );

  const userName = nameRecord.value;
  const initialBalance = balanceRecord.value;
  const monthlyBudget = budgetRecord.value;

  const updateWriteIssue = useCallback((key: string, issue: StorageIssue | null) => {
    setWriteIssues((previous) => {
      const withoutKey = previous.filter((item) => item.key !== key);
      if (!issue) return withoutKey;
      const existing = previous.find((item) => item.key === key && item.kind === issue.kind);
      return existing ? previous : [...withoutKey, issue];
    });
  }, []);

  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveProfile) return;
    setNameRecord((previous) => previous.value === liveProfile.userName && previous.status === 'valid' && !previous.issue
      ? previous
      : { value: liveProfile.userName, status: 'valid' });
    setBalanceRecord((previous) => previous.value === liveProfile.initialBalance && previous.status === 'valid' && !previous.issue
      ? previous
      : { value: liveProfile.initialBalance, status: 'valid' });
    setBudgetRecord((previous) => previous.value === liveProfile.monthlyBudget && previous.status === 'valid' && !previous.issue
      ? previous
      : { value: liveProfile.monthlyBudget, status: 'valid' });
  }, [liveProfile]);

  useEffect(() => {
    if (hasDatabaseBootstrap()) {
      if (!didInitializePersistence.current) {
        didInitializePersistence.current = true;
        return;
      }
      if (!canPersistReadStatus(nameRecord.status) || !canPersistReadStatus(budgetRecord.status)) return;
      void persistProfile({ userName: nameRecord.value, monthlyBudget: budgetRecord.value })
        .then(() => setWriteIssues((previous) => previous.filter((item) => item.key !== NAME_KEY && item.key !== MONTHLY_BUDGET_KEY)))
        .catch(() => {
          setWriteIssues((previous) => {
            const next = previous.filter((item) => item.key !== NAME_KEY && item.key !== MONTHLY_BUDGET_KEY);
            return [...next, { key: NAME_KEY, kind: 'write-failed' }];
          });
        });
      return;
    }
    if (!canPersistReadStatus(nameRecord.status)) return;
    updateWriteIssue(NAME_KEY, writeStoredRawValue(NAME_KEY, nameRecord.value));
  }, [nameRecord.value, nameRecord.status, budgetRecord.value, budgetRecord.status, updateWriteIssue]);

  useEffect(() => {
    if (hasDatabaseBootstrap()) return;
    if (!canPersistReadStatus(balanceRecord.status)) return;
    updateWriteIssue(BALANCE_KEY, writeStoredRawValue(BALANCE_KEY, String(balanceRecord.value)));
  }, [balanceRecord.value, balanceRecord.status, updateWriteIssue]);

  useEffect(() => {
    if (hasDatabaseBootstrap()) return;
    if (!canPersistReadStatus(budgetRecord.status)) return;
    updateWriteIssue(MONTHLY_BUDGET_KEY, writeStoredRawValue(MONTHLY_BUDGET_KEY, String(budgetRecord.value)));
  }, [budgetRecord.value, budgetRecord.status, updateWriteIssue]);

  const updateName = useCallback((name: string) => {
    setNameRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return { ...previous, value: name.trim() || DEFAULT_NAME };
    });
  }, []);

  const updateInitialBalance = useCallback((balance: number) => {
    if (!Number.isFinite(balance) || Math.abs(Math.round(balance)) > MAX_MONEY_AMOUNT || !Number.isSafeInteger(Math.round(balance))) return;
    setBalanceRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return { ...previous, value: Math.round(balance) };
    });
  }, []);

  const updateMonthlyBudget = useCallback((budget: number) => {
    if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_MONEY_AMOUNT || !Number.isSafeInteger(Math.round(budget))) return;
    setBudgetRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return { ...previous, value: Math.round(budget) };
    });
  }, []);

  const storageIssues = [
    nameRecord.issue,
    balanceRecord.issue,
    budgetRecord.issue,
    ...writeIssues,
  ].filter((issue): issue is StorageIssue => Boolean(issue));

  return {
    userName,
    initialBalance,
    monthlyBudget,
    updateName,
    updateInitialBalance,
    updateMonthlyBudget,
    storageIssues,
  };
}
