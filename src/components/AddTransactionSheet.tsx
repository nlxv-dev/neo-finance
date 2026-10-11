import { useState, useRef, useEffect } from 'react';
import { X, Check, Utensils, Car, Home, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';

type TxType = 'expense' | 'income';
type Category = 'Еда' | 'Транспорт' | 'Аренда';

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { amount: number; category: Category; isIncome: boolean }) => void;
}

const categories: { label: Category; icon: typeof Utensils }[] = [
  { label: 'Еда', icon: Utensils },
  { label: 'Транспорт', icon: Car },
  { label: 'Аренда', icon: Home },
];

export function AddTransactionSheet({ open, onClose, onSave }: AddTransactionSheetProps) {
  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('Еда');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when sheet opens; reset state when closed
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
    setAmount('');
    setSelectedCategory('Еда');
    setTxType('expense');
  }, [open]);

  // Lock body scroll while open
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
    onSave({ amount: parsed, category: selectedCategory, isIncome: txType === 'income' });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
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

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: '60vh' }}
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

        <div className="flex h-full flex-col px-6 pb-8">
          {/* Title */}
          <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
            Новая транзакция
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Введите сумму и выберите категорию
          </p>

          {/* Type toggle */}
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

          {/* Amount input */}
          <div className="mt-6 flex flex-col items-center">
            <div className="flex items-baseline justify-center">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={amount ? formatCurrency(parseInt(amount.replace(/\D/g, ''), 10)) : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setAmount(digits.slice(0, 9));
                }}
                placeholder="0"
                className="w-full bg-transparent text-center font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              />
              <span className="ml-1 text-2xl font-light text-neutral-400 dark:text-neutral-500">₽</span>
            </div>
          </div>

          {/* Category pills */}
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Категория
            </p>
            <div className="flex gap-2.5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    onClick={() => setSelectedCategory(cat.label)}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3 transition-all duration-200 active:scale-95 gpu ${
                      active ? 'neu-card-sm ring-1 ring-mint/40 dark:ring-mint/30' : 'neu-inset'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        active ? 'text-mint dark:text-mint' : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                      strokeWidth={2}
                    />
                    <span
                      className={`text-[11px] font-medium ${
                        active
                          ? 'text-neutral-900 dark:text-white'
                          : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacer pushes save button to bottom */}
          <div className="flex-1" />

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!amount || parseInt(amount, 10) <= 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Сохранить транзакцию
          </button>
        </div>
      </div>
    </>
  );
}
