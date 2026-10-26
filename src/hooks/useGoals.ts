import { useCallback, useEffect, useState } from 'react';
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
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const canWrite = canPersistReadStatus(record.status);
  const goals = record.value;

  useEffect(() => {
    if (!canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(GOALS_STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record.value, record.status]);

  const addGoal = useCallback((input: GoalInput): boolean => {
    const name = input.name.trim();
    if (!canWrite || !name || name.length > 80 || !Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0) return false;
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
    setRecord((previous) => canPersistReadStatus(previous.status)
      ? { ...previous, value: [normalized[0], ...previous.value] }
      : previous);
    return true;
  }, [canWrite]);

  const updateGoal = useCallback((id: string, updates: Partial<GoalInput>): boolean => {
    if (!canWrite) return false;
    const existing = goals.find((goal) => goal.id === id);
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
    setRecord((previous) => canPersistReadStatus(previous.status)
      ? { ...previous, value: previous.value.map((goal) => goal.id === id ? normalizedCandidate[0] : goal) }
      : previous);
    return true;
  }, [canWrite, goals]);

  const deleteGoal = useCallback((id: string): boolean => {
    if (!canWrite || !goals.some((goal) => goal.id === id)) return false;
    setRecord((previous) => canPersistReadStatus(previous.status)
      ? { ...previous, value: previous.value.filter((goal) => goal.id !== id) }
      : previous);
    return true;
  }, [canWrite, goals]);

  const addProgress = useCallback((id: string, amount: number): boolean => {
    if (!canWrite || !Number.isSafeInteger(amount) || amount <= 0) return false;
    const goal = goals.find((item) => item.id === id);
    if (!goal || getGoalRemaining(goal) <= 0) return false;
    const normalizedAmount = Math.min(amount, getGoalRemaining(goal));
    setRecord((previous) => canPersistReadStatus(previous.status)
      ? {
        ...previous,
        value: previous.value.map((item) => item.id === id
          ? { ...item, currentAmount: Math.min(item.targetAmount, item.currentAmount + normalizedAmount) }
          : item),
      }
      : previous);
    return true;
  }, [canWrite, goals]);

  const reduceProgress = useCallback((id: string, amount: number): boolean => {
    if (!canWrite || !Number.isSafeInteger(amount) || amount <= 0) return false;
    const goal = goals.find((item) => item.id === id);
    if (!goal || goal.currentAmount <= 0) return false;
    const normalizedAmount = Math.min(amount, goal.currentAmount);
    setRecord((previous) => canPersistReadStatus(previous.status)
      ? {
        ...previous,
        value: previous.value.map((item) => item.id === id
          ? { ...item, currentAmount: Math.max(0, item.currentAmount - normalizedAmount) }
          : item),
      }
      : previous);
    return true;
  }, [canWrite, goals]);

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
    canWrite: canWrite && !writeIssue,
  };
}
