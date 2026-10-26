import { useEffect, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';

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
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDigits(String(currentBudget));
    setKeyboardOpen(false);
  }, [open, currentBudget]);

  const amount = digits === '' ? 0 : Number(digits);
  const isValid = Number.isFinite(amount) && Number.isInteger(amount) && amount > 0;
  const hasChanges = isValid && amount !== currentBudget;

  const handleSave = () => {
    if (!hasChanges) return;
    onSave(amount);
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

  const buttonLabel =
    !digits || !isValid
      ? 'Введите сумму больше нуля'
      : hasChanges
        ? 'Сохранить бюджет'
        : 'Нет изменений';

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
      ariaLabel="Лимит бюджета"
      panelClassName={keyboardOpen ? 'overflow-y-auto' : 'overflow-hidden'}
      panelStyle={{ height: keyboardOpen ? 'auto' : '54vh', maxHeight: keyboardOpen ? '94dvh' : undefined }}
    >
      <div style={{ height: keyboardOpen ? 'auto' : 'calc(100% - 24px)' }} className={`flex flex-col px-6 ${keyboardOpen ? 'pb-3' : 'pb-8'}`}>
        <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
          Лимит бюджета
        </h2>
        {!keyboardOpen && (
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Установите сумму расходов на месяц
          </p>
        )}

        <div className={`${keyboardOpen ? 'mt-4' : 'mt-7'} flex flex-col items-center`}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            <Wallet className="h-3 w-3" />
            Месячный бюджет
          </div>

          <div className="flex items-baseline justify-center">
            <AmountTrigger
              value={digits}
              onChange={setDigits}
              keyboardOpen={keyboardOpen}
              onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
              onOpenKeyboard={() => setKeyboardOpen(true)}
              onCloseKeyboard={() => setKeyboardOpen(false)}
              label="Месячный бюджет в рублях"
              keyboardId="budget-amount-keyboard"
            />
          </div>

          {!keyboardOpen && (
            <div className="mt-3 rounded-full neu-inset px-3 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              Один лимит для каждого месяца
            </div>
          )}
        </div>

        {!keyboardOpen && <div className="flex-1" />}

        {keyboardOpen && (
          <div className="mt-4 flex min-h-0 flex-col gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {buttonLabel}
            </button>
            <AmountKeyboard id="budget-amount-keyboard" value={digits} onChange={setDigits} onClose={() => setKeyboardOpen(false)} label="Клавиатура суммы месячного бюджета" replaceOnFirstDigit />
          </div>
        )}

        {!keyboardOpen && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {buttonLabel}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
