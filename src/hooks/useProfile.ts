import { useState, useCallback, useEffect } from 'react';
import {
  canPersistReadStatus,
  readStoredNumber,
  readStoredString,
  writeStoredRawValue,
  type StorageIssue,
} from '@/storage/safeLocalStorage';

const NAME_KEY = 'fintrack-user-name';
const BALANCE_KEY = 'fintrack-initial-balance';
const MONTHLY_BUDGET_KEY = 'fintrack-monthly-budget';

const DEFAULT_NAME = 'Пользователь';
const DEFAULT_BALANCE = 0;
const DEFAULT_MONTHLY_BUDGET = 50_000;
const MAX_MONEY_AMOUNT = 1_000_000_000_000;

export function useProfile() {
  const [nameRecord, setNameRecord] = useState(() => readStoredString(NAME_KEY, DEFAULT_NAME));
  const [balanceRecord, setBalanceRecord] = useState(() =>
    readStoredNumber(BALANCE_KEY, DEFAULT_BALANCE, (value) => Math.abs(value) <= MAX_MONEY_AMOUNT)
  );
  const [budgetRecord, setBudgetRecord] = useState(() =>
    readStoredNumber(MONTHLY_BUDGET_KEY, DEFAULT_MONTHLY_BUDGET, (value) => value > 0 && value <= MAX_MONEY_AMOUNT)
  );
  const [writeIssues, setWriteIssues] = useState<StorageIssue[]>([]);

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
    if (!canPersistReadStatus(nameRecord.status)) return;
    updateWriteIssue(NAME_KEY, writeStoredRawValue(NAME_KEY, nameRecord.value));
  }, [nameRecord.value, nameRecord.status, updateWriteIssue]);

  useEffect(() => {
    if (!canPersistReadStatus(balanceRecord.status)) return;
    updateWriteIssue(BALANCE_KEY, writeStoredRawValue(BALANCE_KEY, String(balanceRecord.value)));
  }, [balanceRecord.value, balanceRecord.status, updateWriteIssue]);

  useEffect(() => {
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
