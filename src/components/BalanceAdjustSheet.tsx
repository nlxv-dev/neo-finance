import { useEffect, useState } from 'react';
import { Check, Wallet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getCurrencySymbol } from '@/utils/currency';

interface BalanceAdjustSheetProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  accountName?: string;
  currency?: string;
  onAdjust: (targetBalance: number) => void;
}

export function BalanceAdjustSheet({
  open,
  onClose,
  currentBalance,
  accountName = 'Основной счёт',
  currency = 'RUB',
  onAdjust,
}: BalanceAdjustSheetProps) {
  const [isNegative, setIsNegative] = useState(false);
  const [digits, setDigits] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setIsNegative(currentBalance < 0);
      setDigits(String(Math.abs(currentBalance)));
      setKeyboardOpen(false);
    }
  }, [open, currentBalance]);

  const rawAmount = parseInt(digits || '0', 10) || 0;
  const targetAmount = isNegative ? -rawAmount : rawAmount;
  const difference = targetAmount - currentBalance;
  const currencySymbol = getCurrencySymbol(currency);

  const handleSave = () => {
    if (difference === 0) {
      onClose();
      return;
    }

    onAdjust(targetAmount);
    setKeyboardOpen(false);
    onClose();
  };

  const closeOrHideKeyboard = () => {
    if (keyboardOpen) {
      setKeyboardOpen(false);
      return;
    }
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onEscape={closeOrHideKeyboard}
      onBackdropClick={closeOrHideKeyboard}
      onPanelClick={(event) => {
        if (!keyboardOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
        setKeyboardOpen(false);
      }}
      ariaLabel={`Корректировка баланса: ${accountName}`}
      panelClassName={keyboardOpen ? 'overflow-y-auto' : 'overflow-hidden'}
      panelStyle={{ height: keyboardOpen ? 'auto' : '54vh', maxHeight: keyboardOpen ? '94dvh' : undefined }}
    >
      <div style={{ height: keyboardOpen ? 'auto' : 'calc(100% - 24px)' }} className={`flex flex-col px-6 ${keyboardOpen ? 'pb-3' : 'pb-8'}`}>
        <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
          Корректировка баланса
        </h2>

        {!keyboardOpen && (
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Изменение текущего остатка: {accountName}
          </p>
        )}

        <div className={`${keyboardOpen ? 'mt-3' : 'mt-6'} flex flex-col items-center`}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            <Wallet className="h-3 w-3" />
            Новый баланс
          </div>

          <div className="flex items-baseline justify-center">
            {isNegative && (
              <span className="text-4xl font-light text-red-500 dark:text-red-400">
                -
              </span>
            )}

            <AmountTrigger
              value={digits}
              onChange={setDigits}
              keyboardOpen={keyboardOpen}
              onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
              onOpenKeyboard={() => setKeyboardOpen(true)}
              onCloseKeyboard={() => setKeyboardOpen(false)}
              label={`Новое значение баланса счёта «${accountName}» в ${currency}`}
              keyboardId="balance-amount-keyboard"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsNegative((value) => !value)}
            aria-pressed={isNegative}
            className={`${keyboardOpen ? 'mt-2' : 'mt-3'} flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 active:scale-95 ${
              isNegative
                ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                : 'neu-inset text-neutral-400 dark:text-neutral-500'
            }`}
          >
            <Minus className="h-3 w-3" />
            {isNegative ? 'Отрицательный' : 'Сделать отрицательным'}
          </button>
        </div>

        {!keyboardOpen && (
          <div className="mt-4 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              <span>Текущий: {formatCurrency(currentBalance)} {currencySymbol}</span>
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
                {difference > 0 ? '+' : ''}
                {formatCurrency(difference)} {currencySymbol}
                <span className="opacity-60">· Корректировка</span>
              </div>
            )}
          </div>
        )}

        {!keyboardOpen && <div className="flex-1" />}

        {keyboardOpen && (
          <div className="mt-4 flex min-h-0 flex-col gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={difference === 0}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {difference === 0 ? 'Нет изменений' : 'Применить'}
            </button>
            <AmountKeyboard id="balance-amount-keyboard" value={digits} onChange={setDigits} onClose={() => setKeyboardOpen(false)} label="Клавиатура суммы баланса" replaceOnFirstDigit />
          </div>
        )}

        {!keyboardOpen && (
          <button
            type="button"
            onClick={handleSave}
            disabled={difference === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {difference === 0 ? 'Нет изменений' : 'Применить'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
