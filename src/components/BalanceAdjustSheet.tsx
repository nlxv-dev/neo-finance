import { useState, useEffect, useRef } from 'react';
import { X, Check, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';

interface BalanceAdjustSheetProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  onAdjust: (difference: number) => void;
}

export function BalanceAdjustSheet({
  open,
  onClose,
  currentBalance,
  onAdjust,
}: BalanceAdjustSheetProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput(String(currentBalance));
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [open, currentBalance]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const targetAmount = parseInt(input.replace(/\D/g, ''), 10) || 0;
  const difference = targetAmount - currentBalance;

  const handleSave = () => {
    if (difference === 0) {
      onClose();
      return;
    }
    onAdjust(difference);
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
        style={{ height: '52vh' }}
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
            Корректировка баланса
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Введите новое значение общего баланса
          </p>

          {/* Amount input */}
          <div className="mt-6 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            <Wallet className="h-3 w-3" />
            Новый баланс
          </div>
            <div className="flex items-baseline justify-center">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={input ? formatCurrency(parseInt(input.replace(/\D/g, ''), 10)) : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setInput(digits.slice(0, 9));
                }}
                placeholder="0"
                className="w-full bg-transparent text-center font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              />
              <span className="ml-1 text-2xl font-light text-neutral-400 dark:text-neutral-500">₽</span>
            </div>
          </div>

          {/* Difference indicator */}
          <div className="mt-5 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              <span>Текущий: {formatCurrency(currentBalance)} ₽</span>
            </div>
            {difference !== 0 && (
              <div
                className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium ${
                  difference > 0
                    ? 'bg-mint/10 text-mint dark:text-mint'
                    : 'bg-red-500/10 text-red-500 dark:text-red-400'
                }`}
              >
                {difference > 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {difference > 0 ? '+' : ''}{formatCurrency(difference)} ₽
                <span className="opacity-60">· Корректировка</span>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={difference === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {difference === 0 ? 'Нет изменений' : 'Применить'}
          </button>
        </div>
      </div>
    </>
  );
}
