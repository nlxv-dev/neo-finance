import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Goal, GoalInput } from '@/data/goals';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistGoals, queryDatabaseGoals } from '@/storage/databaseStorage';
import { getGoalRemaining, isGoalCompleted, normalizeStoredGoals, type GoalColor } from '@/data/goals';
import { areRecordArraysEqual } from '@/storage/recordEquality';
import {
  canPersistReadStatus,
  readStoredJson,
  writeStoredJson,
  type StorageIssue,
  type StorageReadResult,
} from '@/storage/safeLocalStorage';

export const GOALS_STORAGE_KEY = STORAGE_KEYS.goals;

function loadGoals(): StorageReadResult<Goal[]> {
  // A new install starts with no demo goals or fabricated savings amounts.
  const snapshot = getDatabaseBootstrapSnapshot();
  if (snapshot) return { value: snapshot.goals, status: 'valid' };
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
  const pendingLocalWrites = useRef(0);
  const [writeIssue, setWriteIssue] = useState<StorageIssue | null>(null);
  const liveGoals = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseGoals() : null,
    [],
    null,
  );
  const canWrite = canPersistReadStatus(record.status) && !writeIssue;
  const goals = record.value;

  const applyLiveGoals = useCallback((rows: Goal[]) => {
    if (pendingLocalWrites.current > 0) return;
    const current = recordRef.current;
    if (areRecordArraysEqual(current.value, rows) && current.status === 'valid' && !current.issue) return;
    const next: StorageReadResult<Goal[]> = { value: rows, status: 'valid' };
    recordRef.current = next;
    setRecord(next);
  }, []);

  const refreshLatestGoals = useCallback(async () => {
    try {
      applyLiveGoals(await queryDatabaseGoals());
    } catch {
      setWriteIssue({ key: GOALS_STORAGE_KEY, kind: 'write-failed' });
    }
  }, [applyLiveGoals]);

  const persistLocalGoals = useCallback((previousRows: Goal[], rows: Goal[]) => {
    if (!hasDatabaseBootstrap()) return;
    pendingLocalWrites.current += 1;
    void persistGoals(rows, previousRows).then(() => setWriteIssue(null)).catch(() => {
      setWriteIssue({ key: GOALS_STORAGE_KEY, kind: 'write-failed' });
    }).finally(() => {
      pendingLocalWrites.current = Math.max(0, pendingLocalWrites.current - 1);
      if (pendingLocalWrites.current === 0) void refreshLatestGoals();
    });
  }, [refreshLatestGoals]);

  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveGoals) return;
    applyLiveGoals(liveGoals);
  }, [liveGoals, applyLiveGoals]);

  useEffect(() => {
    // Keep a synchronous ref to the latest committed domain record. In the
    // legacy-only test/recovery path, persistence remains LocalStorage-based.
    recordRef.current = record;
    if (hasDatabaseBootstrap()) return;
    if (!canPersistReadStatus(record.status)) return;
    const issue = writeStoredJson(GOALS_STORAGE_KEY, record.value);
    setWriteIssue((previous) => {
      if (!issue && !previous) return previous;
      if (issue && previous?.key === issue.key && previous.kind === issue.kind) return previous;
      return issue;
    });
  }, [record]);

  const commit = useCallback((next: StorageReadResult<Goal[]>): void => {
    const current = recordRef.current;
    recordRef.current = next;
    setRecord(next);
    persistLocalGoals(current.value, next.value);
  }, [persistLocalGoals]);

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
