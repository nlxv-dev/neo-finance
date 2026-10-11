import { useState, useEffect, useCallback } from 'react';
import {
  type Transaction,
  initialTransactions,
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

export function useTransactions(initialBalance: number) {
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

  const resetTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  const updateTransaction = useCallback((id: number, updates: Partial<TransactionInput>) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              amount: updates.amount ?? tx.amount,
              category: updates.category ?? tx.category,
              title: updates.category ?? tx.title,
              isIncome: updates.isIncome ?? tx.isIncome,
            }
          : tx
      )
    );
  }, []);

  const deleteTransaction = useCallback((id: number) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  const totalIncome = transactions
    .filter((t) => t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = initialBalance + totalIncome - totalExpenses;

  return {
    transactions,
    addTransaction,
    resetTransactions,
    updateTransaction,
    deleteTransaction,
    totalIncome,
    totalExpenses,
    totalBalance,
  };
}
