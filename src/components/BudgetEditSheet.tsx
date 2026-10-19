import { useEffect, useState } from 'react';
import { Check, Wallet, X } from 'lucide-react';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';

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
    setKeyboardOpen(false);
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
        onClick={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      />

      {/* Budget edit bottom sheet */}
      <div
        onClick={(event) => {
          if (!keyboardOpen) return;
          const target = event.target as HTMLElement;
          if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
          setKeyboardOpen(false);
        }}
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass overflow-x-hidden ${keyboardOpen ? 'overflow-y-auto' : 'overflow-hidden'} transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: keyboardOpen ? 'auto' : '54vh', maxHeight: keyboardOpen ? '94dvh' : undefined }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Close button */}
        <button
          onClick={() => { setKeyboardOpen(false); onClose(); }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset transition-transform active:scale-90 gpu"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        </button>

        <div style={{ height: keyboardOpen ? 'auto' : 'calc(100% - 24px)' }} className={`flex flex-col px-6 ${keyboardOpen ? 'pb-3' : 'pb-8'}`}>
          {/* Title */}
          <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
            Лимит бюджета
          </h2>
          {!keyboardOpen && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              Установите сумму расходов на месяц
            </p>
          )}

          {/* Budget input */}
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
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                {buttonLabel}
              </button>
              <AmountKeyboard id="budget-amount-keyboard" value={digits} onChange={setDigits} onClose={() => setKeyboardOpen(false)} label="Клавиатура суммы месячного бюджета" replaceOnFirstDigit />
            </div>
          )}

          {/* Save button in the regular form layout */}
          {!keyboardOpen && <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {buttonLabel}
          </button>}
        </div>
      </div>
    </>
  );
}
