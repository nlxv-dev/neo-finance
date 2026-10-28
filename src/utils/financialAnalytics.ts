import type { CustomCategory } from '@/data/categories';
import type { Transaction } from '@/data/mockData';
import { resolveTransactionDateISO, toLocalISODate } from '@/data/transactionDates';

export type StatisticsViewMode = 'all' | 'income' | 'expense';
export type StatisticsPeriodMode = 'day' | 'month';

export interface DailyStatisticsPoint {
  day: number;
  income: number;
  expenses: number;
}

export interface CategoryStatistics {
  key: string;
  name: string;
  iconName: string;
  amount: number;
  percent: number;
  transactions: Transaction[];
}

export interface PeriodStatisticsTotals {
  income: number;
  expenses: number;
  net: number;
}

export interface StatisticsDateRange {
  startDateISO: string;
  endDateISO: string;
}

export interface StatisticsComparisonPeriods {
  current: StatisticsDateRange;
  previous: StatisticsDateRange;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Selects user-facing income/expense operations for the current analytics window.
 * Internal transfers are excluded here and again in aggregators as a defensive
 * invariant, so moving money between own accounts never becomes income/spending.
 */
export function selectStatisticsTransactions(
  transactions: readonly Transaction[],
  monthKey: string,
  periodMode: StatisticsPeriodMode,
  selectedDateKey: string,
  referenceDate = new Date(),
): Transaction[] {
  const todayKey = toLocalISODate(referenceDate);
  const isCurrentMonth = monthKey === getMonthKey(referenceDate);

  return transactions.filter((transaction) => {
    if (transaction.isTransfer) return false;
    const isoDate = resolveTransactionDateISO(transaction, referenceDate);
    if (!isoDate) return false;
    if (periodMode === 'day') return isoDate === selectedDateKey;
    if (!isoDate.startsWith(`${monthKey}-`)) return false;
    // Do not include future-dated operations in current-month totals while the
    // chart itself ends at today. Historical months remain complete.
    return !isCurrentMonth || isoDate <= todayKey;
  });
}

function parseLocalISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
  ) return null;
  return date;
}

/**
 * Creates comparable local-calendar windows. A day compares with the preceding
 * calendar day. A historical month compares with the preceding full month. The
 * current month compares month-to-date with the same day number in the previous
 * month, capped at that month's final day (for example, Feb 28 in a leap year).
 */
export function getStatisticsComparisonPeriods(
  periodMode: StatisticsPeriodMode,
  selectedMonthKey: string,
  selectedDateKey: string,
  referenceDate = new Date(),
): StatisticsComparisonPeriods {
  if (periodMode === 'day') {
    const selectedDay = parseLocalISODate(selectedDateKey) ?? new Date(
      referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(),
    );
    const previousDay = new Date(
      selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() - 1,
    );
    const currentKey = toLocalISODate(selectedDay);
    const previousKey = toLocalISODate(previousDay);
    return {
      current: { startDateISO: currentKey, endDateISO: currentKey },
      previous: { startDateISO: previousKey, endDateISO: previousKey },
    };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(selectedMonthKey);
  const year = monthMatch ? Number(monthMatch[1]) : referenceDate.getFullYear();
  const monthNumber = monthMatch ? Number(monthMatch[2]) : referenceDate.getMonth() + 1;
  const validMonth = monthNumber >= 1 && monthNumber <= 12;
  const monthStart = new Date(year, (validMonth ? monthNumber : referenceDate.getMonth() + 1) - 1, 1);
  const normalizedMonthKey = getMonthKey(monthStart);
  const isCurrentMonth = normalizedMonthKey === getMonthKey(referenceDate);
  const currentEnd = isCurrentMonth
    ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
    : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const previousMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const previousMonthEnd = isCurrentMonth
    ? new Date(
        previousMonthStart.getFullYear(),
        previousMonthStart.getMonth(),
        Math.min(referenceDate.getDate(), getDaysInMonth(previousMonthStart)),
      )
    : new Date(monthStart.getFullYear(), monthStart.getMonth(), 0);

  return {
    current: { startDateISO: toLocalISODate(monthStart), endDateISO: toLocalISODate(currentEnd) },
    previous: {
      startDateISO: toLocalISODate(previousMonthStart),
      endDateISO: toLocalISODate(previousMonthEnd),
    },
  };
}

/** Selects financial operations from an inclusive local ISO date range. */
export function selectStatisticsTransactionsInRange(
  transactions: readonly Transaction[],
  range: StatisticsDateRange,
  referenceDate = new Date(),
): Transaction[] {
  if (range.startDateISO > range.endDateISO) return [];
  return transactions.filter((transaction) => {
    if (transaction.isTransfer) return false;
    const isoDate = resolveTransactionDateISO(transaction, referenceDate);
    return Boolean(isoDate && isoDate >= range.startDateISO && isoDate <= range.endDateISO);
  });
}

export function calculatePeriodStatistics(
  transactions: readonly Transaction[],
): PeriodStatisticsTotals {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (transaction.isTransfer || !Number.isFinite(transaction.amount)) continue;
    if (transaction.isIncome) income += transaction.amount;
    else expenses += transaction.amount;
  }

  return { income, expenses, net: income - expenses };
}

/** Builds a zero-filled daily series without mutating the provided transactions. */
export function buildDailyStatistics(
  transactions: readonly Transaction[],
  totalDays: number,
): DailyStatisticsPoint[] {
  const safeDayCount = Number.isFinite(totalDays)
    ? Math.max(0, Math.min(31, Math.floor(totalDays)))
    : 0;
  const days = Array.from({ length: safeDayCount }, (_, index) => ({
    day: index + 1,
    income: 0,
    expenses: 0,
  }));

  for (const transaction of transactions) {
    if (transaction.isTransfer || !Number.isFinite(transaction.amount)) continue;
    const isoDate = resolveTransactionDateISO(transaction);
    if (!isoDate) continue;
    const dayNumber = Number(isoDate.slice(8, 10));
    const point = days[dayNumber - 1];
    if (!point) continue;
    if (transaction.isIncome) point.income += transaction.amount;
    else point.expenses += transaction.amount;
  }

  return days;
}

function getCategoryKey(transaction: Transaction): string {
  return transaction.categoryId ?? `legacy:${transaction.category.trim().toLocaleLowerCase('ru-RU')}`;
}

/**
 * Groups period operations by stable category ID. In the combined view this
 * intentionally lists expenses; income remains visible in the period totals.
 */
export function buildCategoryStatistics(
  transactions: readonly Transaction[],
  categories: readonly CustomCategory[],
  mode: StatisticsViewMode,
  periodIncome: number,
  periodExpenses: number,
): CategoryStatistics[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, Omit<CategoryStatistics, 'percent'>>();

  for (const transaction of transactions) {
    if (transaction.isTransfer) continue;
    if (mode === 'income' ? !transaction.isIncome : transaction.isIncome) continue;

    const key = getCategoryKey(transaction);
    const linkedCategory = transaction.categoryId
      ? categoryById.get(transaction.categoryId)
      : undefined;
    const existing = groups.get(key);

    if (existing) {
      existing.amount += transaction.amount;
      existing.transactions.push(transaction);
    } else {
      groups.set(key, {
        key,
        name: linkedCategory?.name ?? (transaction.category.trim() || 'Без категории'),
        iconName: linkedCategory?.iconName ?? transaction.categoryIconName ?? 'HelpCircle',
        amount: transaction.amount,
        transactions: [transaction],
      });
    }
  }

  const denominator = mode === 'income' ? periodIncome : periodExpenses;
  return [...groups.values()]
    .map((group) => ({
      ...group,
      percent: denominator > 0 ? Math.round((group.amount / denominator) * 100) : 0,
      transactions: group.transactions.slice().sort((a, b) => {
        const aDate = resolveTransactionDateISO(a) ?? '';
        const bDate = resolveTransactionDateISO(b) ?? '';
        return bDate.localeCompare(aDate) || b.id - a.id;
      }),
    }))
    .sort((a, b) => b.amount - a.amount);
}


export interface CategoryPeriodChange {
  key: string;
  name: string;
  iconName: string;
  currentAmount: number;
  previousAmount: number;
  difference: number;
}

/**
 * Finds category amounts that changed between comparable periods. In the
 * combined analytics view, category breakdowns remain expense-only, matching
 * buildCategoryStatistics. Internal transfers and invalid amounts are ignored.
 * Results are ranked by the absolute size of the change, not by direction.
 */
export function buildCategoryPeriodChanges(
  currentTransactions: readonly Transaction[],
  previousTransactions: readonly Transaction[],
  categories: readonly CustomCategory[],
  mode: StatisticsViewMode,
): CategoryPeriodChange[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, Omit<CategoryPeriodChange, 'difference'>>();
  const includeIncome = mode === 'income';

  const addTransactions = (
    list: readonly Transaction[],
    amountKey: 'currentAmount' | 'previousAmount',
  ) => {
    for (const transaction of list) {
      if (transaction.isTransfer || !Number.isFinite(transaction.amount)) continue;
      if (transaction.isIncome !== includeIncome) continue;

      const key = getCategoryKey(transaction);
      const linkedCategory = transaction.categoryId
        ? categoryById.get(transaction.categoryId)
        : undefined;
      const existing = groups.get(key);
      if (existing) {
        existing[amountKey] += transaction.amount;
        continue;
      }

      groups.set(key, {
        key,
        name: linkedCategory?.name.trim() || transaction.category.trim() || 'Без категории',
        iconName: linkedCategory?.iconName || transaction.categoryIconName || 'HelpCircle',
        currentAmount: amountKey === 'currentAmount' ? transaction.amount : 0,
        previousAmount: amountKey === 'previousAmount' ? transaction.amount : 0,
      });
    }
  };

  // Add the selected period first so current labels are preferred when legacy
  // records resolve to the same normalized key but contain different spacing.
  addTransactions(currentTransactions, 'currentAmount');
  addTransactions(previousTransactions, 'previousAmount');

  return [...groups.values()]
    .map((group) => ({ ...group, difference: group.currentAmount - group.previousAmount }))
    .filter((group) => group.difference !== 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || a.name.localeCompare(b.name, 'ru-RU'));
}
