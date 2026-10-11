import { useState, useEffect, useCallback } from 'react';
import {
  type Transaction,
  initialTransactions,
  INITIAL_BALANCE,
} from '@/data/mockData';

const STORAGE_KEY = 'fintrack-transactions';

function loadTransactions(): Transaction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Transaction[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore malformed data
  }
  return initialTransactions;
}

export interface TransactionInput {
  amount: number;
  category: string;
  isIncome: boolean;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // storage may be full or unavailable — ignore
    }
  }, [transactions]);

  const addTransaction = useCallback((input: TransactionInput) => {
    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;

    const newTx: Transaction = {
      id: Date.now(),
      title: input.category,
      category: input.category,
      amount: input.amount,
      date: dateStr,
      isIncome: input.isIncome,
    };

    setTransactions((prev) => [newTx, ...prev]);
  }, []);

  // Derived metrics
  const totalIncome = transactions
    .filter((t) => t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = INITIAL_BALANCE + totalIncome - totalExpenses;

  return {
    transactions,
    addTransaction,
    totalIncome,
    totalExpenses,
    totalBalance,
  };
}
