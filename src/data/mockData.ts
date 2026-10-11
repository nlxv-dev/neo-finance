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

export interface Transaction {
  id: number;
  title: string;
  category: string;
  amount: number;
  date: string;
  icon: LucideIcon;
  isIncome: boolean;
}

export const balanceData = {
  totalBalance: 84250,
  monthlyGrowth: 12500,
  income: 45000,
  expenses: 32500,
  monthlyBudget: 50000,
  safeToSpend: 17500,
};

export const transactions: Transaction[] = [
  { id: 1, title: 'Зарплата', category: 'Доход', amount: 45000, date: '10 окт', icon: Briefcase, isIncome: true },
  { id: 2, title: 'Аренда квартиры', category: 'Жильё', amount: 18000, date: '9 окт', icon: Home, isIncome: false },
  { id: 3, title: 'Продукты', category: 'Еда', amount: 2400, date: '8 окт', icon: ShoppingCart, isIncome: false },
  { id: 4, title: 'Ресторан', category: 'Досуг', amount: 3200, date: '7 окт', icon: Utensils, isIncome: false },
  { id: 5, title: 'Фриланс проект', category: 'Доход', amount: 15000, date: '6 окт', icon: Laptop, isIncome: true },
  { id: 6, title: 'Такси', category: 'Транспорт', amount: 650, date: '5 окт', icon: Car, isIncome: false },
  { id: 7, title: 'Netflix', category: 'Подписки', amount: 799, date: '4 окт', icon: Film, isIncome: false },
  { id: 8, title: 'Кофе', category: 'Еда', amount: 350, date: '3 окт', icon: Coffee, isIncome: false },
  { id: 9, title: 'Спортзал', category: 'Здоровье', amount: 2500, date: '2 окт', icon: Dumbbell, isIncome: false },
  { id: 10, title: 'Мобильная связь', category: 'Связь', amount: 1200, date: '1 окт', icon: Smartphone, isIncome: false },
];

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ru-RU');
}
