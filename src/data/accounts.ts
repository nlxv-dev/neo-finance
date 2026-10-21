export type AccountType = 'card' | 'cash' | 'bank' | 'savings' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  iconName: string;
  currency: string;
  initialBalance: number;
  isArchived: boolean;
  color?: string;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc-main',
    name: 'Основной счёт',
    type: 'card',
    iconName: 'CreditCard',
    currency: 'RUB',
    initialBalance: 0,
    isArchived: false,
    color: 'mint',
  },
  {
    id: 'acc-cash',
    name: 'Наличные',
    type: 'cash',
    iconName: 'Coins',
    currency: 'RUB',
    initialBalance: 0,
    isArchived: false,
    color: 'indigoblue',
  },
  {
    id: 'acc-savings',
    name: 'Накопления',
    type: 'savings',
    iconName: 'PiggyBank',
    currency: 'RUB',
    initialBalance: 0,
    isArchived: false,
    color: 'cobalt',
  },
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  card: 'Банковская карта',
  cash: 'Наличные',
  bank: 'Банковский счёт',
  savings: 'Накопительный счёт',
  other: 'Другое',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  card: 'CreditCard',
  cash: 'Coins',
  bank: 'Landmark',
  savings: 'PiggyBank',
  other: 'Wallet',
};
