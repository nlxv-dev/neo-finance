export { formatCurrency } from '@/utils/formatters';

/**
 * Transaction as stored in localStorage — no icon field (icons aren't serializable).
 * The icon is resolved at render time from the linked category.
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

// Пустой массив для чистого старта при первом запуске
export const initialTransactions: Transaction[] = [];

export type BudgetStatus = 'normal' | 'warning' | 'overbudget';

export function getBudgetStatus(spent: number, budget: number): BudgetStatus {
  const pct = (spent / budget) * 100;
  if (pct > 100) return 'overbudget';
  if (pct >= 80) return 'warning';
  return 'normal';
}
