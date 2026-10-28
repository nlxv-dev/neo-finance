/**
 * Canonical category model and legacy-storage normalization.
 * Kept outside React so persistence migration and UI hooks share one contract.
 */
export interface CustomCategory {
  id: string;
  name: string;
  iconName: string;
  isIncome: boolean;
  /** Archived categories stay available to historical transactions but are hidden from new entries. */
  isArchived: boolean;
}

export const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: 'def-1', name: 'Продукты', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
  { id: 'def-2', name: 'Кафе', iconName: 'Pizza', isIncome: false, isArchived: false },
  { id: 'def-3', name: 'Транспорт', iconName: 'Car', isIncome: false, isArchived: false },
  { id: 'def-4', name: 'Зарплата', iconName: 'Briefcase', isIncome: true, isArchived: false },
  { id: 'def-5', name: 'Подарки', iconName: 'Gift', isIncome: true, isArchived: false },
];

interface StoredCategory {
  id: string;
  name: string;
  iconName: string;
  isIncome: boolean;
  isArchived?: boolean;
}

function isStoredCategory(value: unknown): value is StoredCategory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.iconName === 'string' &&
    typeof item.isIncome === 'boolean' &&
    (item.isArchived === undefined || typeof item.isArchived === 'boolean')
  );
}

/** Strict all-or-nothing normalization preserves malformed source data for recovery. */
export function normalizeStoredCategories(value: unknown): CustomCategory[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: CustomCategory[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    if (!isStoredCategory(item)) return null;
    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);
    normalized.push({ ...item, isArchived: item.isArchived === true });
  }

  return normalized;
}
