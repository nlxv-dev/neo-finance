import { useState, useEffect, useCallback } from 'react';
import {
  type Goal,
  type GoalInput,
  DEFAULT_GOALS,
} from '@/data/goals';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

const STORAGE_KEY = 'fintrack-goals';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStoredGoals(value: unknown): Goal[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: Goal[] = [];
  const ids = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) return null;

    if (
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.targetAmount !== 'number' ||
      !Number.isFinite(item.targetAmount) ||
      typeof item.iconName !== 'string' ||
      !item.iconName.trim() ||
      typeof item.color !== 'string'
    ) {
      return null;
    }

    if (ids.has(item.id)) return null;
    ids.add(item.id);

    const currentAmount = typeof item.currentAmount === 'number' && Number.isFinite(item.currentAmount)
      ? Math.max(0, Math.round(item.currentAmount))
      : 0;

    const targetAmount = Math.max(1, Math.round(item.targetAmount));
    const isReached = item.isReached === true || currentAmount >= targetAmount;

    normalized.push({
      id: item.id,
      name: item.name.trim(),
      targetAmount,
      currentAmount,
      currency: typeof item.currency === 'string' && item.currency ? item.currency : 'RUB',
      iconName: item.iconName,
      color: item.color,
      deadline: typeof item.deadline === 'string' && item.deadline ? item.deadline : undefined,
      accountId: typeof item.accountId === 'string' && item.accountId ? item.accountId : null,
      isReached,
      createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
      notes: typeof item.notes === 'string' ? item.notes : undefined,
    });
  }

  return normalized;
}

export function useGoals(dependenciesHealthy = true) {
  const [record, setRecord] = useState<StorageReadResult<Goal[]>>(() => {
    return readStoredJson<Goal[]>(STORAGE_KEY, DEFAULT_GOALS, normalizeStoredGoals);
  });
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);

  // Sync to localStorage
  useEffect(() => {
    if (!dependenciesHealthy || !canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(STORAGE_KEY, record.value);
    setWriteIssue(issue);
  }, [record.value, record.status, dependenciesHealthy]);

  const addGoal = useCallback((input: GoalInput) => {
    const targetAmount = Math.max(1, Math.round(input.targetAmount));
    const currentAmount = Math.max(0, Math.round(input.currentAmount ?? 0));
    const isReached = currentAmount >= targetAmount;

    const newGoal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim(),
      targetAmount,
      currentAmount,
      currency: input.currency || 'RUB',
      iconName: input.iconName || 'Target',
      color: input.color || 'mint',
      deadline: input.deadline,
      accountId: input.accountId ?? null,
      isReached,
      createdAt: new Date().toISOString(),
      notes: input.notes?.trim() || undefined,
    };

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return { ...prev, value: [newGoal, ...prev.value] };
    });

    return newGoal;
  }, [dependenciesHealthy]);

  const updateGoal = useCallback((id: string, updates: Partial<GoalInput>) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((g) => {
          if (g.id !== id) return g;
          const nextTarget = updates.targetAmount !== undefined ? Math.max(1, Math.round(updates.targetAmount)) : g.targetAmount;
          const nextCurrent = updates.currentAmount !== undefined ? Math.max(0, Math.round(updates.currentAmount)) : g.currentAmount;
          const isReached = nextCurrent >= nextTarget;

          return {
            ...g,
            ...updates,
            name: updates.name !== undefined ? updates.name.trim() : g.name,
            targetAmount: nextTarget,
            currentAmount: nextCurrent,
            isReached,
          };
        }),
      };
    });
  }, [dependenciesHealthy]);

  const deleteGoal = useCallback((id: string) => {
    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.filter((g) => g.id !== id),
      };
    });
  }, [dependenciesHealthy]);

  const depositToGoal = useCallback((id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.round(amount);

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((g) => {
          if (g.id !== id) return g;
          const nextCurrent = g.currentAmount + rounded;
          return {
            ...g,
            currentAmount: nextCurrent,
            isReached: nextCurrent >= g.targetAmount,
          };
        }),
      };
    });
  }, [dependenciesHealthy]);

  const withdrawFromGoal = useCallback((id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.round(amount);

    setRecord((prev) => {
      if (!dependenciesHealthy || !canPersistReadStatus(prev.status)) return prev;
      return {
        ...prev,
        value: prev.value.map((g) => {
          if (g.id !== id) return g;
          const nextCurrent = Math.max(0, g.currentAmount - rounded);
          return {
            ...g,
            currentAmount: nextCurrent,
            isReached: nextCurrent >= g.targetAmount,
          };
        }),
      };
    });
  }, [dependenciesHealthy]);

  const goals = record.value;
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const activeCount = goals.filter((g) => !g.isReached).length;
  const completedCount = goals.filter((g) => g.isReached).length;

  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    depositToGoal,
    withdrawFromGoal,
    totalSaved,
    totalTarget,
    overallProgress,
    activeCount,
    completedCount,
    storageIssues,
  };
}
