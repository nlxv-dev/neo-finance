import {
  Briefcase,
  ShoppingCart,
  Home,
  Film,
  Car,
  Utensils,
  Laptop,
  Smartphone,
  Dumbbell,
  type LucideIcon,
} from 'lucide-react';

/**
 * Transaction as stored in localStorage — no icon field (icons aren't serializable).
 * The icon is resolved at render time via the categoryIconMap.
 */
export interface Transaction {
  id: number;
  title: string;
  /** Stable category reference. Null is used only for legacy rows that cannot be mapped safely. */
  categoryId: string | null;
  /** Name snapshot used for legacy/orphaned rows and as a safe display fallback. */
  category: string;
  /** Icon snapshot used when a legacy row cannot be linked to a category. */
  categoryIconName: string;
  amount: number;
  date: string;
  /** Machine-readable transaction date used by analytics and data migration. */
  dateISO?: string;
  isIncome: boolean;
}

export const INITIAL_BALANCE = 0;
export const MONTHLY_BUDGET = 50000;

export const categoryIconMap: Record<string, LucideIcon> = {
  'Доход': Briefcase,
  'Жильё': Home,
  'Еда': Utensils,
  'Досуг': Film,
  'Транспорт': Car,
  'Подписки': Film,
  'Здоровье': Dumbbell,
  'Связь': Smartphone,
  'Фриланс': Laptop,
};

export function getIconForCategory(category: string): LucideIcon {
  return categoryIconMap[category] ?? ShoppingCart;
}

// Пустой массив для чистого старта при первом запуске
export const initialTransactions: Transaction[] = [];

export type BudgetStatus = 'normal' | 'warning' | 'overbudget';

export function getBudgetStatus(spent: number, budget: number): BudgetStatus {
  const pct = (spent / budget) * 100;
  if (pct > 100) return 'overbudget';
  if (pct >= 80) return 'warning';
  return 'normal';
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ru-RU');
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]}`;
}
