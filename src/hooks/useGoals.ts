import { useCallback, useEffect, useRef, useState } from 'react';
import type { Goal, GoalInput } from '@/data/goals';
import { getGoalRemaining, isGoalCompleted, normalizeStoredGoals, type GoalColor } from '@/data/goals';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

export const GOALS_STORAGE_KEY = 'fintrack-goals';

function loadGoals(): StorageReadResult<Goal[]> {
  // A new install starts with no demo goals or fabricated savings amounts.
  return readStoredJson<Goal[]>(GOALS_STORAGE_KEY, [], normalizeStoredGoals);
}

function createGoalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `goal-${crypto.randomUUID()}`;
  }
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useGoals() {
  const [record, setRecord] = useState<StorageReadResult<Goal[]>>(loadGoals);
  const recordRef = useRef(record);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const canWrite = canPersistReadStatus(record.status) && !writeIssue;
  const goals = record.value;

  useEffect(() => {
    // Keep a synchronous ref to the latest committed domain record. Goal actions
    // read and update this ref atomically, so rapid actions cannot overwrite a
    // progress change with values captured by an older render closure.
    recordRef.current = record;
    if (!canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(GOALS_STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record]);

  const commit = useCallback((next: StorageReadResult<Goal[]>): void => {
    recordRef.current = next;
    setRecord(next);
  }, []);

  const addGoal = useCallback((input: GoalInput): boolean => {
    const current = recordRef.current;
    const name = input.name.trim();
    if (!canWrite || !canPersistReadStatus(current.status) || !name || name.length > 80 || !Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0) return false;
    const candidate: Goal = {
      id: createGoalId(),
      name,
      targetAmount: input.targetAmount,
      currentAmount: 0,
      iconName: input.iconName,
      color: input.color,
      ...(input.deadline ? { deadline: input.deadline } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim().slice(0, 300) } : {}),
      createdAt: new Date().toISOString(),
    };
    const normalized = normalizeStoredGoals([candidate]);
    if (!normalized) return false;
    commit({ ...current, value: [normalized[0], ...current.value] });
    return true;
  }, [canWrite, commit]);

  const updateGoal = useCallback((id: string, updates: Partial<GoalInput>): boolean => {
    const current = recordRef.current;
    if (!canWrite || !canPersistReadStatus(current.status)) return false;
    const existing = current.value.find((goal) => goal.id === id);
    if (!existing) return false;
    const candidate: Goal = {
      ...existing,
      name: updates.name === undefined ? existing.name : updates.name.trim(),
      targetAmount: updates.targetAmount === undefined ? existing.targetAmount : updates.targetAmount,
      iconName: updates.iconName ?? existing.iconName,
      color: (updates.color ?? existing.color) as GoalColor,
      deadline: updates.deadline !== undefined ? (updates.deadline || undefined) : existing.deadline,
      notes: updates.notes !== undefined ? (updates.notes.trim() ? updates.notes.trim().slice(0, 300) : undefined) : existing.notes,
    };
    const normalizedCandidate = normalizeStoredGoals([candidate]);
    if (!normalizedCandidate) return false;
    commit({ ...current, value: current.value.map((goal) => goal.id === id ? normalizedCandidate[0] : goal) });
    return true;
  }, [canWrite, commit]);

  const deleteGoal = useCallback((id: string): boolean => {
    const current = recordRef.current;
    if (!canWrite || !canPersistReadStatus(current.status) || !current.value.some((goal) => goal.id === id)) return false;
    commit({ ...current, value: current.value.filter((goal) => goal.id !== id) });
    return true;
  }, [canWrite, commit]);

  const addProgress = useCallback((id: string, amount: number): boolean => {
    const current = recordRef.current;
    if (!canWrite || !canPersistReadStatus(current.status) || !Number.isSafeInteger(amount) || amount <= 0) return false;
    const goal = current.value.find((item) => item.id === id);
    if (!goal || getGoalRemaining(goal) <= 0) return false;
    const normalizedAmount = Math.min(amount, getGoalRemaining(goal));
    commit({
      ...current,
      value: current.value.map((item) => item.id === id
        ? { ...item, currentAmount: Math.min(item.targetAmount, item.currentAmount + normalizedAmount) }
        : item),
    });
    return true;
  }, [canWrite, commit]);

  const reduceProgress = useCallback((id: string, amount: number): boolean => {
    const current = recordRef.current;
    if (!canWrite || !canPersistReadStatus(current.status) || !Number.isSafeInteger(amount) || amount <= 0) return false;
    const goal = current.value.find((item) => item.id === id);
    if (!goal || goal.currentAmount <= 0) return false;
    const normalizedAmount = Math.min(amount, goal.currentAmount);
    commit({
      ...current,
      value: current.value.map((item) => item.id === id
        ? { ...item, currentAmount: Math.max(0, item.currentAmount - normalizedAmount) }
        : item),
    });
    return true;
  }, [canWrite, commit]);

  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const activeCount = goals.filter((goal) => !isGoalCompleted(goal)).length;
  const completedCount = goals.length - activeCount;
  const storageIssues = [record.issue, writeIssue].filter((issue): issue is StorageIssue => Boolean(issue));

  return {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    addProgress,
    reduceProgress,
    totalSaved,
    totalTarget,
    overallProgress,
    activeCount,
    completedCount,
    storageIssues,
    canWrite,
  };
}
