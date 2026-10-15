import { useState, useCallback, useEffect } from 'react';

const NAME_KEY = 'fintrack-user-name';
const BALANCE_KEY = 'fintrack-initial-balance';
const MONTHLY_BUDGET_KEY = 'fintrack-monthly-budget';

const DEFAULT_NAME = 'Пользователь';
const DEFAULT_BALANCE = 0;
const DEFAULT_MONTHLY_BUDGET = 50_000;

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

function loadBalance(): number {
  try {
    const stored = localStorage.getItem(BALANCE_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
  } catch {
    // localStorage may be unavailable; use the default value.
  }

  return DEFAULT_BALANCE;
}

function loadMonthlyBudget(): number {
  try {
    const stored = localStorage.getItem(MONTHLY_BUDGET_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }
  } catch {
    // localStorage may be unavailable; use the default value.
  }

  return DEFAULT_MONTHLY_BUDGET;
}

export function useProfile() {
  const [userName, setUserName] = useState<string>(loadName);
  const [initialBalance, setInitialBalance] = useState<number>(loadBalance);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(loadMonthlyBudget);

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, userName);
    } catch {
      // Ignore storage errors; in-memory state still works.
    }
  }, [userName]);

  useEffect(() => {
    try {
      localStorage.setItem(BALANCE_KEY, String(initialBalance));
    } catch {
      // Ignore storage errors; in-memory state still works.
    }
  }, [initialBalance]);

  useEffect(() => {
    try {
      localStorage.setItem(MONTHLY_BUDGET_KEY, String(monthlyBudget));
    } catch {
      // Ignore storage errors; in-memory state still works.
    }
  }, [monthlyBudget]);

  const updateName = useCallback((name: string) => {
    setUserName(name.trim() || DEFAULT_NAME);
  }, []);

  const updateInitialBalance = useCallback((balance: number) => {
    if (!Number.isFinite(balance)) return;
    setInitialBalance(Math.round(balance));
  }, []);

  const updateMonthlyBudget = useCallback((budget: number) => {
    if (!Number.isFinite(budget) || budget <= 0) return;
    setMonthlyBudget(Math.round(budget));
  }, []);

  return {
    userName,
    initialBalance,
    monthlyBudget,
    updateName,
    updateInitialBalance,
    updateMonthlyBudget,
  };
}
