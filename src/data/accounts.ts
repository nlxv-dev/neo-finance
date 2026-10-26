/**
 * Account domain model for Neo Finance.
 *
 * New accounts created by the first release use RUB. The currency field remains
 * explicit so imported/previously stored foreign-currency accounts can be
 * preserved without accidentally summing unlike currencies together.
 */
export type AccountType = 'card' | 'cash' | 'bank' | 'savings' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  iconName: string;
  currency: string;
  /** Balance at the time this account's transaction history begins. May be negative. */
  initialBalance: number;
  /** Archived accounts remain part of the user's assets until their balance is moved. */
  isArchived: boolean;
  color?: string;
}

export const MAIN_ACCOUNT_ID = 'acc-main';
export const DEFAULT_ACCOUNT_CURRENCY = 'RUB';

/**
 * A single, real account is the only default. We intentionally do not create
 * demo cash/savings accounts for a new user.
 */
export function createMainAccount(initialBalance = 0): Account {
  return {
    id: MAIN_ACCOUNT_ID,
    name: 'Основной счёт',
    type: 'card',
    iconName: 'CreditCard',
    currency: DEFAULT_ACCOUNT_CURRENCY,
    initialBalance: Number.isFinite(initialBalance) ? Math.round(initialBalance) : 0,
    isArchived: false,
    color: 'mint',
  };
}

export function createDefaultAccounts(initialBalance = 0): Account[] {
  return [createMainAccount(initialBalance)];
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  card: 'Банковская карта',
  cash: 'Наличные',
  bank: 'Банковский счёт',
  savings: 'Накопления',
  other: 'Другое',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  card: 'CreditCard',
  cash: 'Coins',
  bank: 'Landmark',
  savings: 'PiggyBank',
  other: 'Wallet',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const ACCOUNT_TYPES: readonly AccountType[] = ['card', 'cash', 'bank', 'savings', 'other'];

/**
 * Strict all-or-nothing normalization prevents partially dropping account data.
 * A malformed array returns null so safeLocalStorage can preserve the raw JSON.
 */
export function normalizeStoredAccounts(value: unknown): Account[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: Account[] = [];
  const seenIds = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;

    if (
      typeof candidate.id !== 'string' || !candidate.id.trim() ||
      typeof candidate.name !== 'string' || !candidate.name.trim() ||
      typeof candidate.type !== 'string' ||
      typeof candidate.iconName !== 'string' ||
      typeof candidate.initialBalance !== 'number' || !Number.isFinite(candidate.initialBalance)
    ) {
      return null;
    }

    const id = candidate.id.trim();
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    const currency = typeof candidate.currency === 'string' && candidate.currency.trim()
      ? candidate.currency.trim().toUpperCase()
      : DEFAULT_ACCOUNT_CURRENCY;
    if (!/^[A-Z]{3}$/.test(currency)) return null;

    normalized.push({
      id,
      name: candidate.name.trim(),
      type: ACCOUNT_TYPES.includes(candidate.type as AccountType)
        ? candidate.type as AccountType
        : 'card',
      iconName: candidate.iconName.trim() || 'CreditCard',
      currency,
      initialBalance: Math.round(candidate.initialBalance),
      isArchived: candidate.isArchived === true,
      color: typeof candidate.color === 'string' ? candidate.color : undefined,
    });
  }

  return normalized;
}
