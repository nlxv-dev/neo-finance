import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { areRecordArraysEqual } from '@/storage/recordEquality';
import {
  DEFAULT_CATEGORIES,
  normalizeStoredCategories,
  type CustomCategory,
} from '@/data/categories';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistCategories, queryDatabaseCategories } from '@/storage/databaseStorage';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

export type { CustomCategory };

const STORAGE_KEY = STORAGE_KEYS.categories;

function loadCategories(): StorageReadResult<CustomCategory[]> {
  const snapshot = getDatabaseBootstrapSnapshot();
  if (snapshot) return { value: snapshot.categories, status: 'valid' as const };
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
  const recordRef = useRef(record);
  const pendingLocalWrites = useRef(0);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const liveCategories = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseCategories() : null,
    [],
    null,
  );
  const categories = record.value;

  const applyLiveCategories = useCallback((rows: CustomCategory[]) => {
    if (pendingLocalWrites.current > 0) return;
    const current = recordRef.current;
    if (areRecordArraysEqual(current.value, rows) && current.status === 'valid' && !current.issue) return;
    const next: StorageReadResult<CustomCategory[]> = { value: rows, status: 'valid' };
    recordRef.current = next;
    setRecord(next);
  }, []);

  const refreshLatestCategories = useCallback(async () => {
    try {
      applyLiveCategories(await queryDatabaseCategories());
    } catch {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }
  }, [applyLiveCategories]);

  const persistLocalCategories = useCallback((previousRows: CustomCategory[], rows: CustomCategory[]) => {
    if (!hasDatabaseBootstrap()) return;
    pendingLocalWrites.current += 1;
    void persistCategories(rows, previousRows).then(() => setWriteIssue(null)).catch(() => {
      setWriteIssue({ key: STORAGE_KEY, kind: 'write-failed' });
    }).finally(() => {
      pendingLocalWrites.current = Math.max(0, pendingLocalWrites.current - 1);
      if (pendingLocalWrites.current === 0) void refreshLatestCategories();
    });
  }, [refreshLatestCategories]);

  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveCategories) return;
    applyLiveCategories(liveCategories);
  }, [liveCategories, applyLiveCategories]);

  const commit = useCallback((next: StorageReadResult<CustomCategory[]>): boolean => {
    const current = recordRef.current;
    if (!canPersistReadStatus(current.status)) return false;
    recordRef.current = next;
    setRecord(next);
    persistLocalCategories(current.value, next.value);
    return true;
  }, [persistLocalCategories]);

  useEffect(() => {
    recordRef.current = record;
    if (hasDatabaseBootstrap()) return;
    if (!canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record]);

  const addCategory = useCallback((name: string, iconName: string, isIncome: boolean) => {
    const trimmedName = name.trim();
    const current = recordRef.current;
    if (!trimmedName || !canPersistReadStatus(current.status)) return;

    const newCategory: CustomCategory = {
      id: createCategoryId(),
      name: trimmedName,
      iconName,
      isIncome,
      isArchived: false,
    };
    commit({ ...current, value: [...current.value, newCategory] });
  }, [commit]);

  const updateCategory = useCallback((id: string, name: string, iconName: string) => {
    const trimmedName = name.trim();
    const current = recordRef.current;
    if (!trimmedName || !canPersistReadStatus(current.status) || !current.value.some((category) => category.id === id && !category.isArchived)) return;
    commit({
      ...current,
      value: current.value.map((category) =>
        category.id === id && !category.isArchived
          ? { ...category, name: trimmedName, iconName }
          : category
      ),
    });
  }, [commit]);

  /**
   * Categories used by transactions are archived instead of removed. Their IDs,
   * names and icons remain resolvable in history, but they are no longer selectable.
   */
  const deleteCategory = useCallback((id: string, keepForHistory: boolean) => {
    const current = recordRef.current;
    if (!canPersistReadStatus(current.status) || !current.value.some((category) => category.id === id)) return;
    commit({
      ...current,
      value: current.value.flatMap((category) => {
        if (category.id !== id) return [category];
        if (keepForHistory) return [{ ...category, isArchived: true }];
        return [];
      }),
    });
  }, [commit]);

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return { categories, addCategory, updateCategory, deleteCategory, storageIssues };
}
