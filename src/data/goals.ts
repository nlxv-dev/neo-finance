/**
 * Personal savings goals are a progress tracker, not money accounts.
 * Updating a goal's currentAmount never changes account balances or transactions.
 */
export type GoalColor = 'mint' | 'indigoblue' | 'amber' | 'purple';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  iconName: string;
  color: GoalColor;
  /** Optional calendar date in YYYY-MM-DD format. */
  deadline?: string;
  notes?: string;
  createdAt: string;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  iconName: string;
  color: GoalColor;
  deadline?: string;
  notes?: string;
}

export const GOAL_ICON_OPTIONS = [
  { name: 'PiggyBank', label: 'Накопления' },
  { name: 'Plane', label: 'Путешествие' },
  { name: 'House', label: 'Дом' },
  { name: 'Laptop', label: 'Техника' },
  { name: 'Car', label: 'Автомобиль' },
  { name: 'GraduationCap', label: 'Обучение' },
  { name: 'Smartphone', label: 'Телефон' },
  { name: 'HeartPulse', label: 'Здоровье' },
  { name: 'Gift', label: 'Покупка' },
  { name: 'Wallet', label: 'Другое' },
] as const;

export const GOAL_COLORS: Array<{ id: GoalColor; label: string; swatchClass: string; iconClass: string; progressClass: string }> = [
  { id: 'mint', label: 'Мятный', swatchClass: 'bg-mint', iconClass: 'bg-mint/15 text-mint', progressClass: 'from-mint to-teal-400' },
  { id: 'indigoblue', label: 'Индиго', swatchClass: 'bg-indigoblue', iconClass: 'bg-indigoblue/15 text-indigoblue', progressClass: 'from-indigoblue to-blue-500' },
  { id: 'amber', label: 'Янтарный', swatchClass: 'bg-amber-500', iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', progressClass: 'from-amber-400 to-orange-500' },
  { id: 'purple', label: 'Пурпурный', swatchClass: 'bg-purple-500', iconClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', progressClass: 'from-purple-500 to-pink-500' },
];

const KNOWN_ICONS = new Set<string>(GOAL_ICON_OPTIONS.map((option) => option.name));
const KNOWN_COLORS = new Set<GoalColor>(GOAL_COLORS.map((option) => option.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isValidGoalDeadline(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Strict all-or-nothing normalization: malformed goal data is not silently discarded. */
export function normalizeStoredGoals(value: unknown): Goal[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const normalized: Goal[] = [];
  const ids = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) return null;
    if (
      typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id.trim()) ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 80 ||
      typeof item.targetAmount !== 'number' || !Number.isSafeInteger(item.targetAmount) || item.targetAmount <= 0 || item.targetAmount > 1_000_000_000_000 ||
      typeof item.currentAmount !== 'number' || !Number.isSafeInteger(item.currentAmount) || item.currentAmount < 0 || item.currentAmount > 1_000_000_000_000 ||
      (item.currency !== undefined && item.currency !== 'RUB') ||
      (item.iconName !== undefined && (typeof item.iconName !== 'string' || !KNOWN_ICONS.has(item.iconName))) ||
      (item.color !== undefined && (typeof item.color !== 'string' || !KNOWN_COLORS.has(item.color as GoalColor))) ||
      (item.deadline !== undefined && item.deadline !== '' && (typeof item.deadline !== 'string' || !isValidGoalDeadline(item.deadline))) ||
      (item.notes !== undefined && typeof item.notes !== 'string') ||
      (item.createdAt !== undefined && typeof item.createdAt !== 'string')
    ) return null;

    const id = item.id.trim();
    ids.add(id);
    normalized.push({
      id,
      name: item.name.trim(),
      targetAmount: item.targetAmount,
      currentAmount: item.currentAmount,
      iconName: typeof item.iconName === 'string' ? item.iconName : 'PiggyBank',
      color: typeof item.color === 'string' && KNOWN_COLORS.has(item.color as GoalColor) ? item.color as GoalColor : 'mint',
      ...(typeof item.deadline === 'string' && item.deadline ? { deadline: item.deadline } : {}),
      ...(typeof item.notes === 'string' && item.notes.trim() ? { notes: item.notes.trim().slice(0, 300) } : {}),
      createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date(0).toISOString(),
    });
  }
  return normalized;
}

export function getGoalRemaining(goal: Pick<Goal, 'targetAmount' | 'currentAmount'>): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

export function getGoalProgressPercent(goal: Pick<Goal, 'targetAmount' | 'currentAmount'>): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
}

export function isGoalCompleted(goal: Pick<Goal, 'targetAmount' | 'currentAmount'>): boolean {
  return goal.currentAmount >= goal.targetAmount;
}

/** Returns null when there is no deadline, the goal is complete, or its date has passed. */
export function getMonthlyRecommendation(
  goal: Pick<Goal, 'targetAmount' | 'currentAmount' | 'deadline'>,
  today = new Date(),
): number | null {
  const remaining = getGoalRemaining(goal);
  if (!goal.deadline || remaining <= 0 || !isValidGoalDeadline(goal.deadline)) return null;
  const [year, month, day] = goal.deadline.split('-').map(Number);
  const deadlineDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (deadlineDate < todayStart) return null;
  const months = Math.max(1, (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth()) + 1);
  return Math.ceil(remaining / months);
}

export function formatGoalDeadline(deadline?: string): string | null {
  if (!deadline || !isValidGoalDeadline(deadline)) return null;
  const [year, month, day] = deadline.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}
