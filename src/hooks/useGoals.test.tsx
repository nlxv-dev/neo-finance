import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GOALS_STORAGE_KEY, useGoals } from './useGoals';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useGoals', () => {
  it('starts empty and persists new goals without demo progress', () => {
    const { result } = renderHook(() => useGoals());
    expect(result.current.goals).toEqual([]);

    act(() => {
      expect(result.current.addGoal({ name: 'Отпуск', targetAmount: 100_000, iconName: 'Plane', color: 'mint' })).toBe(true);
    });

    expect(result.current.goals).toHaveLength(1);
    expect(result.current.goals[0].currentAmount).toBe(0);
    expect(JSON.parse(window.localStorage.getItem(GOALS_STORAGE_KEY) || '[]')[0].currentAmount).toBe(0);
  });

  it('tracks progress without creating or changing transaction or account storage', () => {
    window.localStorage.setItem('fintrack-accounts', JSON.stringify([{ id: 'acc-main' }]));
    window.localStorage.setItem('fintrack-transactions', JSON.stringify([{ id: 1, amount: 20 }]));
    const accountsBefore = window.localStorage.getItem('fintrack-accounts');
    const transactionsBefore = window.localStorage.getItem('fintrack-transactions');
    const { result } = renderHook(() => useGoals());
    let goalId = '';

    act(() => {
      result.current.addGoal({ name: 'Техника', targetAmount: 1000, iconName: 'Laptop', color: 'indigoblue' });
      goalId = result.current.goals[0]?.id ?? '';
    });
    // Resolve the generated goal ID after React has committed the state update.
    goalId = result.current.goals[0].id;
    act(() => { result.current.addProgress(goalId, 300); });
    act(() => { result.current.addProgress(goalId, 999); });

    expect(result.current.goals[0].currentAmount).toBe(1000);
    act(() => { result.current.reduceProgress(goalId, 250); });
    expect(result.current.goals[0].currentAmount).toBe(750);
    expect(window.localStorage.getItem('fintrack-accounts')).toBe(accountsBefore);
    expect(window.localStorage.getItem('fintrack-transactions')).toBe(transactionsBefore);
  });

  it('rejects invalid input without persisting a goal that would corrupt the next read', () => {
    const { result } = renderHook(() => useGoals());
    act(() => {
      expect(result.current.addGoal({ name: 'Несуществующая дата', targetAmount: 100, iconName: 'Plane', color: 'mint', deadline: '2027-02-29' })).toBe(false);
      expect(result.current.addGoal({ name: 'Неизвестная иконка', targetAmount: 100, iconName: 'Unknown', color: 'mint' })).toBe(false);
    });
    expect(result.current.goals).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(GOALS_STORAGE_KEY) || '[]')).toEqual([]);
  });

  it('does not report success for a missing goal ID', () => {
    const { result } = renderHook(() => useGoals());
    act(() => { expect(result.current.updateGoal('missing', { name: 'No goal' })).toBe(false); });
    act(() => { expect(result.current.deleteGoal('missing')).toBe(false); });
  });

  it('does not overwrite malformed local goal data', () => {
    const raw = '[{"id":"broken","targetAmount":12}]';
    window.localStorage.setItem(GOALS_STORAGE_KEY, raw);
    const { result } = renderHook(() => useGoals());

    expect(result.current.canWrite).toBe(false);
    expect(result.current.storageIssues.some((issue) => issue.kind === 'invalid-data')).toBe(true);
    expect(window.localStorage.getItem(GOALS_STORAGE_KEY)).toBe(raw);
    act(() => { expect(result.current.addGoal({ name: 'Test', targetAmount: 100, iconName: 'Plane', color: 'mint' })).toBe(false); });
    expect(window.localStorage.getItem(GOALS_STORAGE_KEY)).toBe(raw);
  });
});
