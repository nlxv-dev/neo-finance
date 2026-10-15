import { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';

import { formatCurrency } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import { IconRenderer } from '@/components/IconRenderer';
import { DeleteConfirmationPanel } from '@/components/DeleteConfirmationPanel';
import { ICON_GROUPS } from '@/data/iconsConfig';

const ICON_GROUP_NAMES = Object.keys(ICON_GROUPS);
const DEFAULT_ICON_GROUP = ICON_GROUP_NAMES.includes('Деньги')
  ? 'Деньги'
  : (ICON_GROUP_NAMES[0] ?? '');

function getIconGroupForIcon(iconName: string): string {
  const match = Object.entries(ICON_GROUPS).find(([, icons]) =>
    (icons as readonly string[]).includes(iconName)
  );

  return match?.[0] ?? DEFAULT_ICON_GROUP;
}

type TxType = 'expense' | 'income';

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  categories: CustomCategory[];
  onAddCategory: (name: string, iconName: string, isIncome: boolean) => void;
  onUpdateCategory: (id: string, name: string, iconName: string) => void;
  onDeleteCategory: (id: string) => void;
  onSave: (data: {
    amount: number;
    categoryId: string;
    isIncome: boolean;
  }) => void;
}

export function AddTransactionSheet({
  open,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSave,
}: AddTransactionSheetProps) {
  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Состояния для конструктора категорий
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState('Wallet');
  const [activeIconGroup, setActiveIconGroup] = useState<string>(DEFAULT_ICON_GROUP);
  const [showIconSelector, setShowIconSelector] = useState(false); // Прогрессивное раскрытие сетки иконок
  const [categoryError, setCategoryError] = useState('');
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = categories.filter(
    (cat) => !cat.isArchived && cat.isIncome === (txType === 'income')
  );

  useEffect(() => {
    if (filteredCategories.length === 0) {
      if (selectedCategoryId) setSelectedCategoryId('');
      return;
    }

    const currentExists = filteredCategories.some(
      (cat) => cat.id === selectedCategoryId
    );

    if (!currentExists) {
      setSelectedCategoryId(filteredCategories[0].id);
    }
  }, [txType, open, categories, selectedCategoryId]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
    setAmount('');
    setTxType('expense');
    setIsCreatingCategory(false);
    setEditingCategoryId(null);
    setNewCategoryName('');
    setSelectedIconName('Wallet');
    setShowIconSelector(false);
    setCategoryError('');
    setCategoryToDeleteId(null);
  }, [open]);

  // Блокируем прокрутку страницы под открытой нижней панелью.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleSave = () => {
    const parsed = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsed || parsed <= 0) return;
    const currentCategory = filteredCategories.find(
      (cat) => cat.id === selectedCategoryId
    );
    if (!currentCategory) return;
    onSave({
      amount: parsed,
      categoryId: currentCategory.id,
      isIncome: txType === 'income',
    });
    onClose();
  };

  const handleCreateOrUpdateCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    const categoryBeingEdited = editingCategoryId
      ? categories.find((category) => category.id === editingCategoryId)
      : undefined;
    const isIncome = categoryBeingEdited?.isIncome ?? (txType === 'income');
    const normalizedName = trimmedName.toLocaleLowerCase('ru-RU');
    const currentNormalizedName = categoryBeingEdited?.name.trim().toLocaleLowerCase('ru-RU');
    const isKeepingExistingName = Boolean(
      categoryBeingEdited && currentNormalizedName === normalizedName
    );
    const duplicate = !isKeepingExistingName && categories.some(
      (category) =>
        category.id !== editingCategoryId &&
        !category.isArchived &&
        category.isIncome === isIncome &&
        category.name.trim().toLocaleLowerCase('ru-RU') === normalizedName
    );

    if (duplicate) {
      setCategoryError('Категория с таким названием уже существует.');
      return;
    }

    setCategoryError('');
    if (editingCategoryId) {
      onUpdateCategory(editingCategoryId, trimmedName, selectedIconName);
    } else {
      onAddCategory(trimmedName, selectedIconName, isIncome);
    }

    setNewCategoryName('');
    setSelectedIconName('Wallet');
    setIsCreatingCategory(false);
    setEditingCategoryId(null);
    setShowIconSelector(false);
  };

  const handleToggleIconSelector = () => {
    if (!showIconSelector) {
      // При раскрытии показываем группу, в которой находится текущая иконка.
      setActiveIconGroup(getIconGroupForIcon(selectedIconName));
    }

    setShowIconSelector((current) => !current);
  };

  const handleDeleteCategory = (id: string) => {
    setCategoryToDeleteId(id);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDeleteId) return;

    onDeleteCategory(categoryToDeleteId);
    setCategoryToDeleteId(null);
    setIsCreatingCategory(false);
    setEditingCategoryId(null);
    setNewCategoryName('');
    setSelectedIconName('Wallet');
    setShowIconSelector(false);
    setCategoryError('');
  };

  const startEditing = (
    catId: string,
    catName: string,
    catIcon: string
  ) => {
    setEditingCategoryId(catId);
    setNewCategoryName(catName);
    setSelectedIconName(catIcon);
    setCategoryError('');
    setShowIconSelector(false);
    setIsCreatingCategory(true);
  };

  const startCreatingCategory = () => {
    setEditingCategoryId(null);
    setNewCategoryName('');
    setSelectedIconName('Wallet');
    setCategoryError('');
    setShowIconSelector(false);
    setIsCreatingCategory(true);
  };

  const categoryPendingDeletion = categoryToDeleteId
    ? categories.find((category) => category.id === categoryToDeleteId) ?? null
    : null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 gpu ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: '75vh' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset transition-transform active:scale-90 gpu"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        </button>

        <div className="flex h-full flex-col px-6 pb-8 overflow-hidden">
          {categoryPendingDeletion ? (
            <DeleteConfirmationPanel
              title="Удалить категорию?"
              description={`«${categoryPendingDeletion.name}» исчезнет из выбора для новых транзакций. Записи в истории сохранятся.`}
              onConfirm={confirmDeleteCategory}
              onCancel={() => setCategoryToDeleteId(null)}
            />
          ) : !isCreatingCategory ? (
            /* РЕЖИМ 1: ДОБАВЛЕНИЕ ТРАНЗАКЦИИ */
            <div className="flex flex-col h-full overflow-y-auto no-scrollbar p-1">
              <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                Новая транзакция
              </h2>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Введите сумму и выберите категорию
              </p>

              <div className="mt-4 flex gap-2">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTxType(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 active:scale-95 gpu ${
                      txType === t
                        ? t === 'income'
                          ? 'bg-mint/15 text-mint'
                          : 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                        : 'neu-inset text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {t === 'income' ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {t === 'income' ? 'Доход' : 'Расход'}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-col items-center">
                <div className="flex items-baseline justify-center">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={
                      amount
                        ? formatCurrency(
                            parseInt(amount.replace(/\D/g, ''), 10)
                          )
                        : ''
                    }
                    onChange={(e) =>
                      setAmount(
                        e.target.value.replace(/\D/g, '').slice(0, 9)
                      )
                    }
                    className="w-full bg-transparent text-center font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums outline-none"
                  />
                  <span className="ml-1 text-2xl font-light text-neutral-400 dark:text-neutral-500">
                    ₽
                  </span>
                </div>
              </div>

              <div className="mt-6 flex-1">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Категория
                </p>
                <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar p-1">
                  {filteredCategories.map((cat) => {
                    const active = selectedCategoryId === cat.id;
                    return (
                      <div key={cat.id} className="relative group">
                        <button
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`w-full flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-all duration-200 active:scale-95 gpu ${
                            active
                              ? 'neu-card-sm ring-1 ring-mint/40 dark:ring-mint/30'
                              : 'neu-inset'
                          }`}
                        >
                          <IconRenderer
                            name={cat.iconName}
                            className={`h-5 w-5 ${
                              active
                                ? 'text-mint'
                                : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-medium truncate max-w-[80px] ${
                              active
                                ? 'text-neutral-900 dark:text-white'
                                : 'text-neutral-400'
                            }`}
                          >
                            {cat.name}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(cat.id, cat.name, cat.iconName);
                          }}
                          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all active:scale-90 p-1 z-10"
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={startCreatingCategory}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/20 text-neutral-400 hover:text-mint transition-all duration-200 active:scale-95 gpu"
                  >
                    <FolderPlus className="h-5 w-5" />
                    <span className="text-[11px] font-medium">
                      Новая категория
                    </span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={
                  !amount ||
                  parseInt(amount.replace(/\D/g, ''), 10) <= 0 ||
                  !filteredCategories.some((cat) => cat.id === selectedCategoryId)
                }
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-95 gpu disabled:opacity-40"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Сохранить транзакцию
              </button>
            </div>
          ) : (
            /* РЕЖИМ 2: КОНСТРУКТОР КАТЕГОРИИ (ПРОГРЕССИВНОЕ РАСКРЫТИЕ) */
            <div className="flex h-full flex-col overflow-hidden">
              <div className="shrink-0">
                <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                  {editingCategoryId
                    ? 'Редактировать категорию'
                    : `Новая категория (${
                        txType === 'income' ? 'Доход' : 'Расход'
                      })`}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                  Задайте имя и выберите иконку при необходимости
                </p>

                {/* Превью + название. Карандаш находится прямо поверх иконки. */}
                <div className="mt-5 flex items-center gap-3 rounded-2xl neu-inset p-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint/10 text-mint">
                    <IconRenderer
                      name={selectedIconName}
                      className="h-5 w-5"
                    />
                    <button
                      type="button"
                      onClick={handleToggleIconSelector}
                      className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full transition-all active:scale-90 z-10 shadow-sm border ${
                        showIconSelector
                          ? 'bg-mint text-white border-mint'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                      }`}
                      aria-label="Изменить иконку"
                      aria-expanded={showIconSelector}
                      aria-controls="category-icon-selector"
                      title="Изменить иконку"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    maxLength={15}
                    value={newCategoryName}
                    onChange={(e) => { setNewCategoryName(e.target.value); setCategoryError(''); }}
                    placeholder="Название (например, Налоги)"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-900 dark:text-white outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  />
                </div>
                {categoryError && (
                  <p className="mt-2 text-xs font-medium text-red-500" role="alert">
                    {categoryError}
                  </p>
                )}
              </div>

              {/* Аккордеон: плавно раскрывается и сворачивается */}
              <div
                id="category-icon-selector"
                aria-hidden={!showIconSelector}
                className={`grid min-h-0 flex-1 overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                  showIconSelector
                    ? 'mt-4 grid-rows-[minmax(0,1fr)] opacity-100'
                    : 'mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="flex min-h-0 flex-col overflow-hidden">
                  <div className="shrink-0">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {Object.keys(ICON_GROUPS).map((groupName) => (
                        <button
                          key={groupName}
                          type="button"
                          tabIndex={showIconSelector ? 0 : -1}
                          onClick={() => setActiveIconGroup(groupName)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                            activeIconGroup === groupName
                              ? 'bg-mint text-white shadow-sm'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {groupName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex-1 overflow-y-auto no-scrollbar pr-1">
                    <div className="grid grid-cols-6 gap-2">
                      {(ICON_GROUPS[
                        activeIconGroup as keyof typeof ICON_GROUPS
                      ] ?? []).map((iconName) => {
                        const isSelected = selectedIconName === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            tabIndex={showIconSelector ? 0 : -1}
                            onClick={() => setSelectedIconName(iconName)}
                            className={`flex h-12 items-center justify-center rounded-xl transition-all duration-150 active:scale-90 ${
                              isSelected
                                ? 'bg-mint text-white shadow-md shadow-mint/20'
                                : 'bg-white dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 border border-neutral-100 dark:border-neutral-800'
                            }`}
                            aria-label={iconName}
                          >
                            <IconRenderer
                              name={iconName}
                              className="h-5 w-5"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки управления */}
              <div className="mt-4 shrink-0 space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setEditingCategoryId(null);
                      setNewCategoryName('');
                      setSelectedIconName('Wallet');
                      setShowIconSelector(false);
                      setCategoryError('');
                    }}
                    className="flex-1 py-3 text-sm font-semibold rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 active:scale-95 transition-transform"
                  >
                    Назад
                  </button>

                  <button
                    onClick={handleCreateOrUpdateCategory}
                    disabled={!newCategoryName.trim()}
                    className="flex-1 py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-mint to-indigoblue text-white active:scale-95 transition-transform disabled:opacity-40"
                  >
                    {editingCategoryId
                      ? 'Сохранить изменения'
                      : 'Создать категорию'}
                  </button>
                </div>

                {editingCategoryId && (
                  <button
                    onClick={() => handleDeleteCategory(editingCategoryId)}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить эту категорию
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
