import {
  Briefcase,
  ShoppingCart,
  Coffee,
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
  category: string;
  amount: number;
  date: string;
  isIncome: boolean;
}

export const INITIAL_BALANCE = 70000;
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

export const initialTransactions: Transaction[] = [
  { id: 1, title: 'Зарплата', category: 'Доход', amount: 45000, date: '10 окт', isIncome: true },
  { id: 2, title: 'Аренда квартиры', category: 'Жильё', amount: 18000, date: '9 окт', isIncome: false },
  { id: 3, title: 'Продукты', category: 'Еда', amount: 2400, date: '8 окт', isIncome: false },
  { id: 4, title: 'Ресторан', category: 'Досуг', amount: 3200, date: '7 окт', isIncome: false },
  { id: 5, title: 'Фриланс проект', category: 'Фриланс', amount: 15000, date: '6 окт', isIncome: true },
  { id: 6, title: 'Такси', category: 'Транспорт', amount: 650, date: '5 окт', isIncome: false },
  { id: 7, title: 'Netflix', category: 'Подписки', amount: 799, date: '4 окт', isIncome: false },
  { id: 8, title: 'Кофе', category: 'Еда', amount: 350, date: '3 окт', isIncome: false },
  { id: 9, title: 'Спортзал', category: 'Здоровье', amount: 2500, date: '2 окт', isIncome: false },
  { id: 10, title: 'Мобильная связь', category: 'Связь', amount: 1200, date: '1 окт', isIncome: false },
];

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
