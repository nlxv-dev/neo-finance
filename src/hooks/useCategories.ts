import { useState, useEffect, useCallback } from 'react';

export interface CustomCategory {
  id: string;
  name: string;
  iconName: string;
  isIncome: boolean;
}

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: 'def-1', name: 'Продукты', iconName: 'ShoppingCart', isIncome: false },
  { id: 'def-2', name: 'Кафе', iconName: 'Pizza', isIncome: false },
  { id: 'def-3', name: 'Транспорт', iconName: 'Car', isIncome: false },
  { id: 'def-4', name: 'Зарплата', iconName: 'Briefcase', isIncome: true },
  { id: 'def-5', name: 'Подарки', iconName: 'Gift', isIncome: true },
];

export function useCategories() {
  const [categories, setCategories] = useState<CustomCategory[]>(() => {
    const saved = localStorage.getItem('neo_finance_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  useEffect(() => {
    localStorage.setItem('neo_finance_categories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = useCallback((name: string, iconName: string, isIncome: boolean) => {
    const newCategory: CustomCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      iconName,
      isIncome
    };
    setCategories((prev) => [...prev, newCategory]);
  }, []);

  // НОВАЯ ФУНКЦИЯ: Редактирование существующей категории
  const updateCategory = useCallback((id: string, name: string, iconName: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, name: name.trim(), iconName } : cat))
    );
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter(cat => cat.id !== id));
  }, []);

  return {
    categories,
    addCategory,
    updateCategory, // Отдаем её в интерфейс
    deleteCategory
  };
}
