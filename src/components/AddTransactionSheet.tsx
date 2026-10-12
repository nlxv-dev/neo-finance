import { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  FolderPlus,
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

  // Состояния для редактора новой категории
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState('Wallet');
  const [activeIconGroup, setActiveIconGroup] = useState<string>('Деньги');

  const inputRef = useRef<HTMLInputElement>(null);

  // Подключаем наш умный хук базы данных категорий
  const { categories, addCategory } = useCategories();

  // Фильтруем категории под текущий тип
  const filteredCategories = categories.filter(
    (cat) => cat.isIncome === (txType === 'income')
  );

  // Сбрасываем выбранную категорию на первую доступную
  // при смене типа или открытии
  useEffect(() => {
    if (filteredCategories.length > 0) {
      setSelectedCategoryId(filteredCategories[0].id);
    }
  }, [txType, open, categories]);

  // Фокус ввода и сброс состояния шторки
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
    setNewCategoryName('');
    setSelectedIconName('Wallet');
  }, [open]);

  // Блокировка скролла body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  const handleSave = () => {
    const parsed = parseInt(amount.replace(/\D/g, ''), 10);

    if (!parsed || parsed <= 0) return;

    // Находим имя выбранной категории по её ID
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

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    // Сохраняем в localStorage через хук
    addCategory(
      newCategoryName.trim(),
      selectedIconName,
      txType === 'income'
    );

    // Сбрасываем форму создания категории
    setNewCategoryName('');
    setIsCreatingCategory(false);
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
              РЕЖИМ 1: ОБЫЧНОЕ ДОБАВЛЕНИЕ ТРАНЗАКЦИИ
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

              {/* Поле ввода суммы */}
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
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
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

              {/* Сетка категорий */}
              <div className="mt-6 flex-1">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Категория
                </p>

                <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                  {filteredCategories.map((cat) => {
                    const active = selectedCategoryId === cat.id;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-all duration-200 active:scale-95 gpu ${
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
                          className={`text-[11px] font-medium truncate max-w-[85px] ${
                            active
                              ? 'text-neutral-900 dark:text-white'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* Кнопка открытия конструктора кастомной категории */}
                  <button
                    onClick={() => setIsCreatingCategory(true)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/20 text-neutral-400 hover:text-mint dark:text-neutral-500 transition-all duration-200 active:scale-95 gpu"
                  >
                    <FolderPlus className="h-5 w-5" />

                    <span className="text-[11px] font-medium">
                      Новая категория
                    </span>
                  </button>
                </div>
              </div>

              {/* Кнопка сохранения транзакции */}
              <button
                onClick={handleSave}
                disabled={!amount || parseInt(amount, 10) <= 0}
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
              >
                <Check className="h-4 w-4" />
                Сохранить транзакцию
              </button>
            </div>
          ) : (
            /* ============================================================
               РЕЖИМ 2: СУПЕРКОНСТРУКТОР КАСТОМНОЙ КАТЕГОРИИ
            ============================================================ */
            <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
              <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                Новая категория{' '}
                <span className="text-mint">
                  ({txType === 'income' ? 'Доход' : 'Расход'})
                </span>
              </h2>

              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Задайте имя и выберите подходящую иконку
              </p>

              {/* Инпут названия категории */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl neu-inset px-4 py-3">
                <input
                  type="text"
                  maxLength={15}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Название (например, Налоги)"
                  className="flex-1 bg-transparent text-sm font-medium text-neutral-900 dark:text-white outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                />

                <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                  {newCategoryName.length}/15
                </span>
              </div>

              {/* Горизонтальный скролл тематических групп иконок */}
              <div className="mt-5 overflow-x-auto no-scrollbar">
                <div className="flex w-max gap-2">
                  {Object.keys(ICON_GROUPS).map((groupName) => (
                    <button
                      key={groupName}
                      onClick={() => setActiveIconGroup(groupName)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                        activeIconGroup === groupName
                          ? 'bg-mint text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {groupName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Сетка выбора иконок */}
              <div className="mt-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
                <div className="grid grid-cols-5 gap-2">
                  {ICON_GROUPS[
                    activeIconGroup as keyof typeof ICON_GROUPS
                  ].map((iconName) => {
                    const isSelected = selectedIconName === iconName;

                    return (
                      <button
                        key={iconName}
                        onClick={() => setSelectedIconName(iconName)}
                        aria-label={iconName}
                        className={`flex h-12 items-center justify-center rounded-xl transition-all duration-150 active:scale-90 ${
                          isSelected
                            ? 'bg-mint text-white shadow-md shadow-mint/20'
                            : 'bg-white dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 border border-neutral-100 dark:border-neutral-800'
                        }`}
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

              {/* Кнопки управления конструктором */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setIsCreatingCategory(false)}
                  className="flex-1 py-3 text-sm font-semibold rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 active:scale-95 transition-transform"
                >
                  Назад
                </button>

                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-mint to-indigoblue text-white active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  <Check className="h-4 w-4" />
                  Добавить категорию
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
