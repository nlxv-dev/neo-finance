import { useEffect, useRef, useState } from 'react';
import { Check, Wallet, X } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';

interface BudgetEditSheetProps {
  open: boolean;
  onClose: () => void;
  currentBudget: number;
  onSave: (budget: number) => void;
}

export function BudgetEditSheet({
  open,
  onClose,
  currentBudget,
  onSave,
}: BudgetEditSheetProps) {
  const [digits, setDigits] = useState(String(currentBudget));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setDigits(String(currentBudget));

    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 350);

    return () => clearTimeout(timer);
  }, [open, currentBudget]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  const amount = digits === '' ? 0 : Number(digits);
  const isValid = Number.isFinite(amount) && Number.isInteger(amount) && amount > 0;
  const hasChanges = isValid && amount !== currentBudget;

  const handleSave = () => {
    if (!hasChanges) return;
    onSave(amount);
    onClose();
  };

  const buttonLabel =
    !digits || !isValid
      ? 'Введите сумму больше нуля'
      : hasChanges
        ? 'Сохранить бюджет'
        : 'Нет изменений';

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

      {/* Budget edit bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: '54vh' }}
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
            Лимит бюджета
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Установите сумму расходов на месяц
          </p>

          {/* Budget input */}
          <div className="mt-7 flex flex-col items-center">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <Wallet className="h-3 w-3" />
              Месячный бюджет
            </div>

            <div className="flex items-baseline justify-center">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={digits ? formatCurrency(Number(digits)) : ''}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/\D/g, '').slice(0, 9);
                  setDigits(cleaned);
                }}
                aria-label="Месячный бюджет в рублях"
                className="w-full bg-transparent text-center font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums outline-none"
              />
              <span className="ml-1 text-2xl font-light text-neutral-400 dark:text-neutral-500">
                ₽
              </span>
            </div>

            <div className="mt-3 rounded-full neu-inset px-3 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              Один лимит для каждого месяца
            </div>
          </div>

          <div className="flex-1" />

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {buttonLabel}
          </button>
        </div>
      </div>
    </>
  );
}
