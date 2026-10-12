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
import { useCategories } from '@/hooks/useCategories';
import { IconRenderer } from '@/components/IconRenderer';
import { ICON_GROUPS } from '@/data/iconsConfig';

type TxType = 'expense' | 'income';

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    amount: number;
    category: string;
    isIncome: boolean;
  }) => void;
}
export function AddTransactionSheet({
  open,
  onClose,
  onSave,
}: AddTransactionSheetProps) {
  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  // Состояния редактора / конструктора категории
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState('Wallet');
  const [activeIconGroup, setActiveIconGroup] = useState<string>('Деньги');
  const inputRef = useRef<HTMLInputElement>(null);
  // Хук категорий
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();
  const filteredCategories = categories.filter(
    (cat) => cat.isIncome === (txType === 'income')
  );

  const iconGroupNames = Object.keys(ICON_GROUPS) as Array<keyof typeof ICON_GROUPS>;
  const activeIconGroupKey = (
    iconGroupNames.includes(activeIconGroup as keyof typeof ICON_GROUPS)
      ? activeIconGroup
      : iconGroupNames[0]
  ) as keyof typeof ICON_GROUPS;
  // Сохраняем выбор, только если категория подходит выбранному типу.
  // При переключении дохода/расхода или удалении категории выбираем доступную.
  useEffect(() => {
    const categoryIsValid = categories.some(
      (cat) =>
        cat.id === selectedCategoryId &&
        cat.isIncome === (txType === 'income')
    );

    if (categoryIsValid) return;

    const firstAvailableCategory = categories.find(
      (cat) => cat.isIncome === (txType === 'income')
    );

    setSelectedCategoryId(firstAvailableCategory?.id ?? '');
  }, [txType, categories, selectedCategoryId]);
  // Фокус и сброс состояния при закрытии
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
    setAmount('');
    setTxType('expense');
    setIsCreatingCategory(false);
    setEditingCategoryId(null);
    setNewCategoryName('');
    setSelectedIconName('Wallet');
  }, [open]);
  // Блокировка скролла страницы
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);
  // Сохранение транзакции
  const handleSave = () => {
    const parsed = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsed || parsed <= 0) return;
    const currentCategory = categories.find(
      (cat) => cat.id === selectedCategoryId
    );
    if (!currentCategory) return;
    onSave({
      amount: parsed,
      category: currentCategory.name,
      isIncome: txType === 'income',
    });
    onClose();
  };
  // Создание или редактирование категории
  const handleCreateOrUpdateCategory = () => {
    if (!newCategoryName.trim()) return;
    if (editingCategoryId) {
      // Редактирование существующей категории
      updateCategory(
        editingCategoryId,
        newCategoryName.trim(),
        selectedIconName
      );
    } else {
      // Создание новой категории
      addCategory(
        newCategoryName.trim(),
        selectedIconName,
        txType === 'income'
      );
    }
    setNewCategoryName('');
    setIsCreatingCategory(false);
    setEditingCategoryId(null);
  };
  // Удаление категории
  const handleDeleteCategory = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту категорию?')) {
      deleteCategory(id);
      setIsCreatingCategory(false);
      setEditingCategoryId(null);
      setNewCategoryName('');
      setSelectedIconName('Wallet');
    }
  };

  // Открытие редактора существующей категории
  const startEditing = (
    catId: string,
    catName: string,
    catIcon: string
  ) => {
    setEditingCategoryId(catId);
    setNewCategoryName(catName);
    // Показываем текущую иконку и открываем её группу в конструкторе.
    setSelectedIconName(catIcon);

    const groupContainingIcon = Object.entries(ICON_GROUPS).find(
      ([, icons]) => icons.includes(catIcon)
    )?.[0];

    if (groupContainingIcon) {
      setActiveIconGroup(groupContainingIcon);
    }

    setIsCreatingCategory(true);
  };

  // Открытие конструктора новой категории
  const startCreatingCategory = () => {
    setEditingCategoryId(null);
    setNewCategoryName('');
    setSelectedIconName('Wallet');
    setIsCreatingCategory(true);
  };
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 gpu ${
          open
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />
      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: '75vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset transition-transform active:scale-90 gpu"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        </button>
        <div className="flex h-full flex-col px-6 pb-8 overflow-hidden">
          {/* ============================================================
              РЕЖИМ 1: ДОБАВЛЕНИЕ ТРАНЗАКЦИИ
          ============================================================ */}
          {!isCreatingCategory ? (
            <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
              <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                Новая транзакция
              </h2>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Введите сумму и выберите категорию
              </p>
              {/* Переключатель Доход / Расход */}
              <div className="mt-4 flex gap-2">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTxType(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 active:scale-95 gpu ${
                      txType === t
                        ? t === 'income'
                          ? 'bg-mint/15 text-mint dark:bg-mint/15 dark:text-mint'
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
              {/* Поле суммы */}
              <div className="mt-6 flex flex-col items-center">
                <div className="flex items-baseline justify-center">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={
                      amount
                        ? formatCurrency(
                            parseInt(
                              amount.replace(/\D/g, ''),
                              10
                            )
                          )
                        : ''
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(
                        /\D/g,
                        ''
                      );
                      setAmount(digits.slice(0, 9));
                    }}
                    placeholder="0"
                    className="w-full bg-transparent text-center font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
                  />
                  <span className="ml-1 text-2xl font-light text-neutral-400 dark:text-neutral-500">
                    ₽
                  </span>
                </div>
              </div>
              {/* Категории */}
              <div className="mt-6 flex-1">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Категория
                </p>
                <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar p-1">
                  {filteredCategories.map((cat) => {
                    const active =
                      selectedCategoryId === cat.id;
                    return (
                      <div
                        key={cat.id}
                        className="relative group"
                      >
                        {/* Карточка категории */}
                        <button
                          onClick={() =>
                            setSelectedCategoryId(cat.id)
                          }
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
                                ? 'text-mint dark:text-mint'
                                : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-medium truncate max-w-[80px] ${
                              active
                                ? 'text-neutral-900 dark:text-white'
                                : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          >
                            {cat.name}
                          </span>
                        </button>
                        {/* Карандаш — теперь полностью внутри карточки */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(
                              cat.id,
                              cat.name,
                              cat.iconName
                            );
                          }}
                          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm opacity-0 group-hover:opacity-100 transition-all active:scale-90 z-10"
                          aria-label="Редактировать категорию"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                  {/* Новая категория */}
                  <button
                    onClick={startCreatingCategory}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/20 text-neutral-400 hover:text-mint dark:text-neutral-500 transition-all duration-200 active:scale-95 gpu"
                  >
                    <FolderPlus className="h-5 w-5" />
                    <span className="text-[11px] font-medium">
                      Новая категория
                    </span>
                  </button>
                </div>
              </div>
              {/* Сохранить транзакцию */}
              <button
                onClick={handleSave}
                disabled={
                  !amount ||
                  parseInt(
                    amount.replace(/\D/g, ''),
                    10
                  ) <= 0
                }
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-95 gpu disabled:opacity-40 disabled:active:scale-100"
              >
                <Check className="h-4 w-4" />
                Сохранить транзакцию
              </button>
            </div>
          ) : (
            /* ============================================================
               РЕЖИМ 2: КОНСТРУКТОР КАТЕГОРИИ
            ============================================================ */
            <div className="flex h-full flex-col overflow-hidden">
              <div className="shrink-0">
                <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                  {editingCategoryId
                    ? 'Редактировать категорию'
                    : `Новая категория (${
                        txType === 'income'
                          ? 'Доход'
                          : 'Расход'
                      })`}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                  Задайте имя и выберите одну из 150+
                  доступных иконок
                </p>
                {/* Превью + название */}
                <div className="mt-5 flex items-center gap-3 rounded-2xl neu-inset p-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint/10 text-mint">
                    <IconRenderer
                      name={selectedIconName}
                      className="h-5 w-5"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={15}
                    value={newCategoryName}
                    onChange={(e) =>
                      setNewCategoryName(e.target.value)
                    }
                    placeholder="Название (например, Налоги)"
                    className="flex-1 bg-transparent text-sm font-medium text-neutral-900 dark:text-white outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  />
                </div>
              </div>
              {/* Группы иконок */}
              <div className="mt-5 shrink-0">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {Object.keys(ICON_GROUPS).map((groupName) => (
                    <button
                      key={groupName}
                      onClick={() =>
                        setActiveIconGroup(groupName)
                      }
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
              {/* Сетка иконок */}
              <div className="mt-4 flex-1 overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-6 gap-2">
                  {(ICON_GROUPS[activeIconGroupKey] ?? []).map((iconName) => {
                    const isSelected =
                      selectedIconName === iconName;
                    return (
                      <button
                        key={iconName}
                        onClick={() =>
                          setSelectedIconName(iconName)
                        }
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
              {/* Кнопки управления */}
              <div className="mt-4 shrink-0 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setEditingCategoryId(null);
                    }}
                    className="flex-1 py-3 text-sm font-semibold rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 active:scale-95 transition-transform"
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleCreateOrUpdateCategory}
                    disabled={!newCategoryName.trim()}
                    className="flex-1 py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-mint to-indigoblue text-white active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                  >
                    {editingCategoryId
                      ? 'Сохранить изменения'
                      : 'Создать категорию'}
                  </button>
                </div>
                {/* Удаление категории */}
                {editingCategoryId && (
                  <button
                    onClick={() =>
                      handleDeleteCategory(editingCategoryId)
                    }
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
