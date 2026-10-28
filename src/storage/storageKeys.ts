/** Canonical names of all legacy LocalStorage keys. Do not rename during migration. */
export const STORAGE_KEYS = {
  transactions: 'fintrack-transactions',
  accounts: 'fintrack-accounts',
  goals: 'fintrack-goals',
  categories: 'neo_finance_categories',
  userName: 'fintrack-user-name',
  initialBalance: 'fintrack-initial-balance',
  monthlyBudget: 'fintrack-monthly-budget',
  theme: 'fintrack-theme',
  backgroundStyle: 'fintrack-background-style',
} as const;

export const LAST_BACKUP_KEY = 'neo-finance-last-backup';

/** Durable fence that prevents stale legacy LocalStorage data being re-imported after Dexie has become authoritative. */
export const DEXIE_PRIMARY_MARKER_KEY = 'neo-finance-dexie-primary-v1';
export const DEXIE_PRIMARY_MARKER_VALUE = 'dexie-primary-v1';

/** Keys included verbatim in the emergency recovery snapshot. */
export const RECOVERY_KEYS = [
  STORAGE_KEYS.transactions,
  STORAGE_KEYS.accounts,
  STORAGE_KEYS.goals,
  STORAGE_KEYS.categories,
  STORAGE_KEYS.userName,
  STORAGE_KEYS.initialBalance,
  STORAGE_KEYS.monthlyBudget,
  STORAGE_KEYS.theme,
  STORAGE_KEYS.backgroundStyle,
  DEXIE_PRIMARY_MARKER_KEY,
] as const;
