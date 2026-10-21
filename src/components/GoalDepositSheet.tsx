import { useState, useEffect } from 'react';
import {
  X,
  Check,
  Plus,
  Minus,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type { Goal } from '@/data/goals';
import { getGoalRemaining, getGoalProgressPercent } from '@/data/goals';
import type { Account } from '@/data/accounts';
import { formatCurrency } from '@/data/mockData';
import { IconRenderer } from '@/components/IconRenderer';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';

interface GoalDepositSheetProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  accounts?: Account[];
  onDeposit: (goalId: string, amount: number, sourceAccountId?: string | null) => void;
  onWithdraw: (goalId: string, amount: number, destinationAccountId?: string | null) => void;
}

export function GoalDepositSheet({
  open,
  onClose,
  goal,
  accounts = [],
  onDeposit,
  onWithdraw,
}: GoalDepositSheetProps) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountDigits, setAmountDigits] = useState('5000');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && goal) {
      setMode('deposit');
      const remaining = getGoalRemaining(goal);
      const suggested = remaining > 0 ? Math.min(remaining, 5000) : 1000;
      setAmountDigits(String(suggested));
      setSelectedAccountId(goal.accountId || accounts[0]?.id || null);
      setKeyboardOpen(false);
      setError('');
    }
  }, [open, goal, accounts]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !goal) return null;

  const remaining = getGoalRemaining(goal);
  const currentPercent = getGoalProgressPercent(goal);
  const parsedAmount = parseInt(amountDigits || '0', 10) || 0;
  const projectedAmount = mode === 'deposit'
    ? goal.currentAmount + parsedAmount
    : Math.max(0, goal.currentAmount - parsedAmount);
  const willReachGoal = mode === 'deposit' && projectedAmount >= goal.targetAmount;

  const handleSubmit = () => {
    if (parsedAmount <= 0) {
      setError('Введите сумму операции больше нуля');
      return;
    }

    if (mode === 'withdraw' && parsedAmount > goal.currentAmount) {
      setError(`Нельзя вывести больше накопленной суммы (${formatCurrency(goal.currentAmount)} ₽)`);
      return;
    }

    if (mode === 'deposit') {
      onDeposit(goal.id, parsedAmount, selectedAccountId);
    } else {
      onWithdraw(goal.id, parsedAmount, selectedAccountId);
    }

    onClose();
  };

  const handleQuickAmount = (val: number) => {
    setAmountDigits(String(val));
    if (error) setError('');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 gpu"
        onClick={() => {
          if (keyboardOpen) setKeyboardOpen(false);
          else onClose();
        }}
      />

      {/* Sheet Modal */}
      <div
        onClick={(e) => {
          if (!keyboardOpen) return;
          const target = e.target as HTMLElement;
          if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
          setKeyboardOpen(false);
        }}
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu overflow-y-auto no-scrollbar ${
          keyboardOpen ? 'max-h-[95dvh]' : 'max-h-[88vh]'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset text-neutral-500 active:scale-90 dark:text-neutral-400"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col p-6 pt-2 pb-8">
          {/* Goal Header Summary */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl neu-card-sm text-mint">
              <IconRenderer name={goal.iconName} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-neutral-900 truncate dark:text-white">
                {goal.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>{formatCurrency(goal.currentAmount)} из {formatCurrency(goal.targetAmount)} ₽</span>
                <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-semibold text-mint">
                  {currentPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selector (Deposit vs Withdraw) */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('deposit');
                if (error) setError('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-medium transition-all ${
                mode === 'deposit'
                  ? 'bg-mint text-neutral-950 font-semibold shadow-sm'
                  : 'neu-inset text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Пополнить цель</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('withdraw');
                if (error) setError('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-medium transition-all ${
                mode === 'withdraw'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                  : 'neu-inset text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <Minus className="h-3.5 w-3.5" />
              <span>Снять средства</span>
            </button>
          </div>

          {/* Amount Display */}
          <div className="mb-4 flex flex-col items-center rounded-2xl neu-inset p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {mode === 'deposit' ? 'Сумма пополнения' : 'Сумма снятия'}
            </span>
            <div className="flex items-baseline justify-center mt-1">
              <AmountTrigger
                value={amountDigits}
                onChange={setAmountDigits}
                keyboardOpen={keyboardOpen}
                onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
                onOpenKeyboard={() => setKeyboardOpen(true)}
                onCloseKeyboard={() => setKeyboardOpen(false)}
                label="Сумма"
                keyboardId="goal-deposit-keyboard"
                showCurrency={false}
                showZeroPlaceholder
              />
              <span className="ml-1 text-xl font-light text-neutral-400">₽</span>
            </div>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>

          {keyboardOpen ? (
            /* Клавиатура заменяет остальные блоки на время ввода */
            <div className="flex flex-col gap-3 animate-fade-in">
              <AmountKeyboard
                id="goal-deposit-keyboard"
                value={amountDigits}
                onChange={setAmountDigits}
                onClose={() => setKeyboardOpen(false)}
                label="Клавиатура суммы"
                replaceOnFirstDigit
              />
              <button
                type="button"
                onClick={() => setKeyboardOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Готово
              </button>
            </div>
          ) : (
            <>
              {/* Quick Amount Chips */}
              <div className="mb-4 flex flex-wrap gap-2">
                {[1000, 3000, 5000, 10000].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickAmount(chip)}
                    className="flex-1 rounded-xl neu-inset py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-transform active:scale-95"
                  >
                    +{formatCurrency(chip)}
                  </button>
                ))}
                {mode === 'deposit' && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(remaining)}
                    className="w-full rounded-xl bg-mint/10 py-2 text-xs font-semibold text-mint hover:bg-mint/15 transition-all"
                  >
                    Всю оставшуюся сумму ({formatCurrency(remaining)} ₽)
                  </button>
                )}
              </div>

              {/* Will Reach Goal Highlight */}
              {willReachGoal && (
                <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-mint/15 p-3 text-mint dark:bg-mint/20">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <p className="text-xs font-medium leading-snug">
                    С этим пополнением цель «{goal.name}» будет <span className="font-bold underline">полностью достигнута</span>! 🎉
                  </p>
                </div>
              )}

              {/* Source Account (Optional) */}
              {accounts.length > 0 && (
                <div className="mb-5">
                  <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {mode === 'deposit' ? 'Списать со счёта (необязательно)' : 'Зачислить на счёт (необязательно)'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(null)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedAccountId === null
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      Без счёта
                    </button>
                    {accounts.filter((a) => !a.isArchived).map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          selectedAccountId === acc.id
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        <IconRenderer name={acc.iconName} className="h-3 w-3" />
                        <span>{acc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] gpu"
              >
                {mode === 'deposit' ? (
                  <>
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
                    Пополнить на {formatCurrency(parsedAmount)} ₽
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Снять {formatCurrency(parsedAmount)} ₽
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
