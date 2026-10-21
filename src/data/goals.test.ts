import { describe, it, expect } from 'vitest';
import {
  getGoalRemaining,
  getGoalProgressPercent,
  getMonthlyRecommendation,
  type Goal,
} from './goals';

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'test-goal',
    name: 'Тестовая цель',
    targetAmount: 100000,
    currentAmount: 40000,
    currency: 'RUB',
    iconName: 'Target',
    color: 'mint',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('goals calculation utilities', () => {
  describe('getGoalRemaining', () => {
    it('returns positive difference between target and current', () => {
      const goal = createGoal({ targetAmount: 100000, currentAmount: 35000 });
      expect(getGoalRemaining(goal)).toBe(65000);
    });

    it('returns 0 when current amount equals target amount', () => {
      const goal = createGoal({ targetAmount: 50000, currentAmount: 50000 });
      expect(getGoalRemaining(goal)).toBe(0);
    });

    it('returns 0 when current amount exceeds target amount', () => {
      const goal = createGoal({ targetAmount: 50000, currentAmount: 70000 });
      expect(getGoalRemaining(goal)).toBe(0);
    });

    it('returns target when current amount is 0', () => {
      const goal = createGoal({ targetAmount: 80000, currentAmount: 0 });
      expect(getGoalRemaining(goal)).toBe(80000);
    });
  });

  describe('getGoalProgressPercent', () => {
    it('calculates correct rounded percentage', () => {
      const goal = createGoal({ targetAmount: 100000, currentAmount: 33333 });
      expect(getGoalProgressPercent(goal)).toBe(33);
    });

    it('returns 100 when current equals target', () => {
      const goal = createGoal({ targetAmount: 100000, currentAmount: 100000 });
      expect(getGoalProgressPercent(goal)).toBe(100);
    });

    it('caps percentage at 100 even if overfunded', () => {
      const goal = createGoal({ targetAmount: 100000, currentAmount: 150000 });
      expect(getGoalProgressPercent(goal)).toBe(100);
    });

    it('returns 100 when target is 0 or negative', () => {
      const goal = createGoal({ targetAmount: 0, currentAmount: 0 });
      expect(getGoalProgressPercent(goal)).toBe(100);
    });

    it('returns 0 when current amount is 0', () => {
      const goal = createGoal({ targetAmount: 100000, currentAmount: 0 });
      expect(getGoalProgressPercent(goal)).toBe(0);
    });
  });

  describe('getMonthlyRecommendation', () => {
    it('returns null when no deadline is set', () => {
      const goal = createGoal({ deadline: undefined });
      expect(getMonthlyRecommendation(goal)).toBeNull();
    });

    it('returns null when goal is marked as reached', () => {
      const goal = createGoal({ deadline: '2026-12-31', isReached: true });
      expect(getMonthlyRecommendation(goal)).toBeNull();
    });

    it('returns 0 when goal is already fully funded', () => {
      const goal = createGoal({
        targetAmount: 100000,
        currentAmount: 100000,
        deadline: '2026-12-31',
        isReached: false,
      });
      expect(getMonthlyRecommendation(goal)).toBe(0);
    });

    it('returns remaining amount when deadline is in the past or this month', () => {
      const goal = createGoal({
        targetAmount: 100000,
        currentAmount: 40000,
        deadline: '2020-01-01',
      });
      expect(getMonthlyRecommendation(goal)).toBe(60000);
    });

    it('divides remaining amount evenly across future months', () => {
      const now = new Date();
      // Target 5 months in the future
      const targetDate = new Date(now.getFullYear(), now.getMonth() + 5, 1);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const deadline = `${year}-${month}-01`;

      const goal = createGoal({
        targetAmount: 100000,
        currentAmount: 50000,
        deadline,
      });
      // 50000 / 5 = 10000
      expect(getMonthlyRecommendation(goal)).toBe(10000);
    });
  });
});
