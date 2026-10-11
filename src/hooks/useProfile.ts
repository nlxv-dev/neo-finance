import { useState, useCallback, useEffect } from 'react';

const NAME_KEY = 'fintrack-user-name';
const BALANCE_KEY = 'fintrack-initial-balance';

const DEFAULT_NAME = 'Иван Петров';
const DEFAULT_BALANCE = 70000;

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
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_BALANCE;
}

export function useProfile() {
  const [userName, setUserName] = useState<string>(loadName);
  const [initialBalance, setInitialBalance] = useState<number>(loadBalance);

  useEffect(() => {
    try { localStorage.setItem(NAME_KEY, userName); } catch { /* ignore */ }
  }, [userName]);

  useEffect(() => {
    try { localStorage.setItem(BALANCE_KEY, String(initialBalance)); } catch { /* ignore */ }
  }, [initialBalance]);

  const updateName = useCallback((name: string) => {
    setUserName(name.trim() || DEFAULT_NAME);
  }, []);

  const updateInitialBalance = useCallback((balance: number) => {
    setInitialBalance(Math.max(0, Math.round(balance)));
  }, []);

  return {
    userName,
    initialBalance,
    updateName,
    updateInitialBalance,
  };
}
