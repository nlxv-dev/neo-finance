import { describe, expect, it } from 'vitest';
import {
  formatGoalDeadline,
  getGoalProgressPercent,
  getGoalRemaining,
  getMonthlyRecommendation,
  isGoalCompleted,
  isValidGoalDeadline,
  normalizeStoredGoals,
  type Goal,
} from './goals';

const goal: Goal = {
  id: 'goal-trip',
  name: 'Отпуск',
  targetAmount: 120_000,
  currentAmount: 30_000,
  iconName: 'Plane',
  color: 'mint',
  deadline: '2027-03-15',
  createdAt: '2026-10-26T00:00:00.000Z',
};

describe('goal domain calculations', () => {
  it('calculates remaining amount and caps progress at 100%', () => {
    expect(getGoalRemaining(goal)).toBe(90_000);
    expect(getGoalProgressPercent(goal)).toBe(25);
    expect(getGoalProgressPercent({ targetAmount: 100, currentAmount: 150 })).toBe(100);
    expect(isGoalCompleted({ targetAmount: 100, currentAmount: 100 })).toBe(true);
  });

  it('calculates a monthly recommendation including the deadline month', () => {
    expect(getMonthlyRecommendation(goal, new Date(2026, 9, 26))).toBe(15_000);
  });

  it('does not recommend saving for completed goals or past deadlines', () => {
    expect(getMonthlyRecommendation({ ...goal, currentAmount: goal.targetAmount }, new Date(2026, 9, 26))).toBeNull();
    expect(getMonthlyRecommendation({ ...goal, deadline: '2026-01-01' }, new Date(2026, 9, 26))).toBeNull();
    expect(getMonthlyRecommendation({ ...goal, deadline: undefined }, new Date(2026, 9, 26))).toBeNull();
  });

  it('formats a date-only deadline without UTC day shifts', () => {
    expect(formatGoalDeadline('2027-03-15')).toContain('15');
    expect(formatGoalDeadline('2027-03-15')).toContain('мар');
    expect(formatGoalDeadline('invalid')).toBeNull();
  });

  it('validates real calendar dates instead of accepting a matching string pattern', () => {
    expect(isValidGoalDeadline('2027-03-15')).toBe(true);
    expect(isValidGoalDeadline('2027-02-29')).toBe(false);
    expect(isValidGoalDeadline('2028-02-29')).toBe(true);
    expect(isValidGoalDeadline('2027-13-01')).toBe(false);
  });

  it('normalizes an empty list without creating demo goals', () => {
    expect(normalizeStoredGoals([])).toEqual([]);
  });

  it('rejects corrupt goals as a whole rather than dropping invalid rows', () => {
    expect(normalizeStoredGoals([{ ...goal, currentAmount: -1 }])).toBeNull();
    expect(normalizeStoredGoals([{ ...goal }, { ...goal }])).toBeNull();
    expect(normalizeStoredGoals([{ ...goal, iconName: 'NotRegistered' }])).toBeNull();
    expect(normalizeStoredGoals([{ ...goal, color: 'cobalt' }])).toBeNull();
  });
});
