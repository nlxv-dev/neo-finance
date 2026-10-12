import { useState, useEffect, useCallback } from 'react';
import { type Transaction, initialTransactions } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';

const STORAGE_KEY = 'fintrack-transactions';

type StoredTransaction = Partial<Transaction> & {
  category?: unknown;
  title?: unknown;
  categoryId?: unknown;
  categoryIconName?: unknown;
  amount?: unknown;
  date?: unknown;
  isIncome?: unknown;
  id?: unknown;
};

function normalizeStoredTransactions(value: unknown, categories: CustomCategory[]): Transaction[] {
  if (!Array.isArray(value)) return initialTransactions;

  return value
    .filter((item): item is StoredTransaction => Boolean(item && typeof item === 'object'))
    .filter((item) =>
      typeof item.id === 'number' &&
      typeof item.amount === 'number' &&
      Number.isFinite(item.amount) &&
      typeof item.date === 'string' &&
      typeof item.isIncome === 'boolean'
    )
    .map((item) => {
      const categoryName =
        typeof item.category === 'string'
          ? item.category
          : typeof item.title === 'string'
            ? item.title
            : 'Без категории';

      const hasCategoryIdField = Object.prototype.hasOwnProperty.call(item, 'categoryId');
      const existingId = typeof item.categoryId === 'string' ? item.categoryId : null;
      let linkedCategory: CustomCategory | undefined;

      if (existingId) {
        linkedCategory = categories.find((category) => category.id === existingId);
      } else if (!hasCategoryIdField) {
        // Legacy entries stored only a name. Migrate only if the match is unambiguous.
        const matches = categories.filter(
          (category) =>
            !category.isArchived &&
            category.name.trim().toLocaleLowerCase('ru-RU') === categoryName.trim().toLocaleLowerCase('ru-RU') &&
            category.isIncome === item.isIncome
        );
        if (matches.length === 1) linkedCategory = matches[0];
      }

      const legacyIcon = typeof item.categoryIconName === 'string'
        ? item.categoryIconName
        : 'HelpCircle';
      const safeId = linkedCategory?.id ?? (hasCategoryIdField ? existingId : null);
      const displayName = linkedCategory?.name ?? categoryName;
      const iconName = linkedCategory?.iconName ?? legacyIcon;

      return {
        id: item.id as number,
        title: typeof item.title === 'string' ? (linkedCategory?.name ?? item.title) : displayName,
        categoryId: safeId,
        category: displayName,
        categoryIconName: iconName,
        amount: item.amount as number,
        date: item.date as string,
        isIncome: item.isIncome as boolean,
      };
    });
}

function loadTransactions(categories: CustomCategory[]): Transaction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeStoredTransactions(JSON.parse(stored) as unknown, categories);
  } catch {
    // If saved data is malformed or storage is unavailable, start with an empty list.
  }
  return initialTransactions;
}

export interface TransactionInput {
  amount: number;
  categoryId: string;
  isIncome: boolean;
}

export function useTransactions(initialBalance: number, categories: CustomCategory[]) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions(categories));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // Storage may be full or unavailable — keep the in-memory changes usable.
    }
  }, [transactions]);

  const addTransaction = useCallback((input: TransactionInput) => {
    const selectedCategory = categories.find((category) => category.id === input.categoryId);
    if (!selectedCategory || selectedCategory.isArchived || selectedCategory.isIncome !== input.isIncome) return;

    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]}`;

    const newTx: Transaction = {
      id: Date.now(),
      title: selectedCategory.name,
      categoryId: selectedCategory.id,
      category: selectedCategory.name,
      categoryIconName: selectedCategory.iconName,
      amount: input.amount,
      date: dateStr,
      isIncome: input.isIncome,
    };

    setTransactions((prev) => [newTx, ...prev]);
  }, [categories]);

  const resetTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  const updateTransaction = useCallback((id: number, updates: Partial<TransactionInput>) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;

        const nextCategoryId = updates.categoryId ?? tx.categoryId;
        const selectedCategory = nextCategoryId
          ? categories.find((category) => category.id === nextCategoryId)
          : undefined;

        return {
          ...tx,
          amount: updates.amount ?? tx.amount,
          categoryId: nextCategoryId,
          category: selectedCategory?.name ?? tx.category,
          categoryIconName: selectedCategory?.iconName ?? tx.categoryIconName,
          title: selectedCategory?.name ?? tx.title,
          isIncome: updates.isIncome ?? tx.isIncome,
        };
      })
    );
  }, [categories]);

  const deleteTransaction = useCallback((id: number) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  const totalIncome = transactions
    .filter((transaction) => transaction.isIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalExpenses = transactions
    .filter((transaction) => !transaction.isIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

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
