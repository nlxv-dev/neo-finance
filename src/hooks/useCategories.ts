import { useState, useEffect, useCallback } from 'react';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
} from '@/storage/safeLocalStorage';

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

interface StoredCategory {
  id: string;
  name: string;
  iconName: string;
  isIncome: boolean;
  isArchived?: boolean;
}

function isStoredCategory(value: unknown): value is StoredCategory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.iconName === 'string' &&
    typeof item.isIncome === 'boolean' &&
    (item.isArchived === undefined || typeof item.isArchived === 'boolean')
  );
}

function normalizeStoredCategories(value: unknown): CustomCategory[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: CustomCategory[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    if (!isStoredCategory(item)) {
      return null;
    }

    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);
    normalized.push({ ...item, isArchived: item.isArchived === true });
  }

  return normalized;
}

function loadCategories() {
  return readStoredJson(STORAGE_KEY, DEFAULT_CATEGORIES, normalizeStoredCategories);
}

function createCategoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cat-${crypto.randomUUID()}`;
  }
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useCategories() {
  const [record, setRecord] = useState(loadCategories);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const categories = record.value;

  useEffect(() => {
    if (!canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record.value, record.status]);

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

    setRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return { ...previous, value: [...previous.value, newCategory] };
    });
  }, []);

  const updateCategory = useCallback((id: string, name: string, iconName: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return {
        ...previous,
        value: previous.value.map((category) =>
          category.id === id && !category.isArchived
            ? { ...category, name: trimmedName, iconName }
            : category
        ),
      };
    });
  }, []);

  /**
   * Categories used by transactions are archived instead of removed. Their IDs,
   * names and icons remain resolvable in history, but they are no longer selectable.
   */
  const deleteCategory = useCallback((id: string, keepForHistory: boolean) => {
    setRecord((previous) => {
      if (!canPersistReadStatus(previous.status)) return previous;
      return {
        ...previous,
        value: previous.value.flatMap((category) => {
          if (category.id !== id) return [category];
          if (keepForHistory) return [{ ...category, isArchived: true }];
          return [];
        }),
      };
    });
  }, []);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return { categories, addCategory, updateCategory, deleteCategory, storageIssues };
}
