export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency?: string;
  iconName: string;
  color: string;
  deadline?: string;        // YYYY-MM-DD
  accountId?: string | null;// Linked account (optional)
  isReached?: boolean;
  createdAt: string;        // ISO timestamp
  notes?: string;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  iconName: string;
  color: string;
  deadline?: string;
  accountId?: string | null;
  notes?: string;
}

export const GOAL_COLORS = [
  { id: 'mint', label: 'Мятный', bg: 'bg-mint', text: 'text-mint', gradient: 'from-mint to-teal-400', ring: 'ring-mint' },
  { id: 'indigoblue', label: 'Индиго', bg: 'bg-indigoblue', text: 'text-indigoblue', gradient: 'from-indigoblue to-blue-500', ring: 'ring-indigoblue' },
  { id: 'cobalt', label: 'Кобальт', bg: 'bg-cobalt', text: 'text-cobalt', gradient: 'from-cobalt to-indigo-600', ring: 'ring-cobalt' },
  { id: 'amber', label: 'Янтарный', bg: 'bg-amber-500', text: 'text-amber-500', gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-500' },
  { id: 'purple', label: 'Пурпурный', bg: 'bg-purple-500', text: 'text-purple-400', gradient: 'from-purple-500 to-pink-500', ring: 'ring-purple-500' },
  { id: 'rose', label: 'Розовый', bg: 'bg-rose-500', text: 'text-rose-400', gradient: 'from-rose-500 to-pink-600', ring: 'ring-rose-500' },
] as const;

export const DEFAULT_GOALS: Goal[] = [
  {
    id: 'goal-emergency-fund',
    name: 'Подушка безопасности',
    targetAmount: 300000,
    currentAmount: 180000,
    currency: 'RUB',
    iconName: 'ShieldCheck',
    color: 'mint',
    deadline: '2026-12-31',
    accountId: 'acc-savings',
    isReached: false,
    createdAt: '2026-01-10T10:00:00.000Z',
    notes: 'Запас на 3-6 месяцев обязательных расходов',
  },
  {
    id: 'goal-vacation',
    name: 'Отпуск на море',
    targetAmount: 150000,
    currentAmount: 95000,
    currency: 'RUB',
    iconName: 'Palmtree',
    color: 'cobalt',
    deadline: '2026-08-15',
    accountId: 'acc-main',
    isReached: false,
    createdAt: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 'goal-laptop',
    name: 'Новый MacBook',
    targetAmount: 220000,
    currentAmount: 220000,
    currency: 'RUB',
    iconName: 'Laptop',
    color: 'indigoblue',
    deadline: '2026-04-01',
    isReached: true,
    createdAt: '2025-11-15T09:00:00.000Z',
  },
];

/**
 * Calculates remaining amount to reach the goal.
 */
export function getGoalRemaining(goal: Goal): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

/**
 * Calculates percentage completion (0-100%).
 */
export function getGoalProgressPercent(goal: Goal): number {
  if (goal.targetAmount <= 0) return 100;
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
}

/**
 * Calculates recommended monthly deposit if a deadline is set.
 */
export function getMonthlyRecommendation(goal: Goal): number | null {
  if (!goal.deadline || goal.isReached) return null;
  const remaining = getGoalRemaining(goal);
  if (remaining <= 0) return 0;

  const deadlineDate = new Date(goal.deadline);
  const now = new Date();
  const diffMonths = (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth());

  if (diffMonths <= 0) {
    return remaining; // Due this month or overdue
  }

  return Math.ceil(remaining / diffMonths);
}
