import { useState, useEffect, useCallback } from 'react';

export interface CustomCategory {
  id: string;
  name: string;
  iconName: string;
  isIncome: boolean;
  /** Archived categories stay available to historical transactions but are hidden from new entries. */
  isArchived: boolean;
}

const STORAGE_KEY = 'neo_finance_categories';

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: 'def-1', name: 'Продукты', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
  { id: 'def-2', name: 'Кафе', iconName: 'Pizza', isIncome: false, isArchived: false },
  { id: 'def-3', name: 'Транспорт', iconName: 'Car', isIncome: false, isArchived: false },
  { id: 'def-4', name: 'Зарплата', iconName: 'Briefcase', isIncome: true, isArchived: false },
  { id: 'def-5', name: 'Подарки', iconName: 'Gift', isIncome: true, isArchived: false },
];

function loadCategories(): CustomCategory[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_CATEGORIES;

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;

    return parsed
      .filter((item): item is Omit<CustomCategory, 'isArchived'> & { isArchived?: boolean } =>
        Boolean(
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.iconName === 'string' &&
          typeof item.isIncome === 'boolean'
        )
      )
      .map((category) => ({ ...category, isArchived: category.isArchived === true }));
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function createCategoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cat-${crypto.randomUUID()}`;
  }
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useCategories() {
  const [categories, setCategories] = useState<CustomCategory[]>(loadCategories);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // Storage can be unavailable in private browsing or when the quota is full.
    }
  }, [categories]);

  const addCategory = useCallback((name: string, iconName: string, isIncome: boolean) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const newCategory: CustomCategory = {
      id: createCategoryId(),
      name: trimmedName,
      iconName,
      isIncome,
      isArchived: false,
    };
    setCategories((prev) => [...prev, newCategory]);
  }, []);

  const updateCategory = useCallback((id: string, name: string, iconName: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCategories((prev) =>
      prev.map((category) =>
        category.id === id && !category.isArchived
          ? { ...category, name: trimmedName, iconName }
          : category
      )
    );
  }, []);

  /**
   * Categories used by transactions are archived instead of removed. Their IDs,
   * names and icons remain resolvable in history, but they are no longer selectable.
   */
  const deleteCategory = useCallback((id: string, keepForHistory: boolean) => {
    setCategories((prev) =>
      prev.flatMap((category) => {
        if (category.id !== id) return [category];
        if (keepForHistory) return [{ ...category, isArchived: true }];
        return [];
      })
    );
  }, []);

  return { categories, addCategory, updateCategory, deleteCategory };
}
