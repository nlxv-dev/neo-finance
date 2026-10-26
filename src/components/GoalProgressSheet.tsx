import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatCurrency } from '@/data/mockData';
import { getGoalRemaining, type Goal } from '@/data/goals';

type ProgressMode = 'add' | 'reduce';

interface GoalProgressSheetProps {
  open: boolean;
  goal: Goal | null;
  canWrite: boolean;
  onClose: () => void;
  onSave: (mode: ProgressMode, amount: number) => boolean;
}

export function GoalProgressSheet({ open, goal, canWrite, onClose, onSave }: GoalProgressSheetProps) {
  const [mode, setMode] = useState<ProgressMode>('add');
  const [amountDigits, setAmountDigits] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('add');
    setAmountDigits('');
    setKeyboardOpen(false);
    setError('');
  }, [open, goal]);

  if (!goal) return null;

  const remaining = getGoalRemaining(goal);
  const available = mode === 'add' ? remaining : goal.currentAmount;
  const handleSave = () => {
    const amount = Number(amountDigits);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError('Введите целую сумму больше нуля.');
      return;
    }
    if (amount > available) {
      setError(`Максимальная сумма — ${formatCurrency(available)} ₽.`);
      return;
    }
    if (!canWrite) {
      setError('Хранилище целей доступно только для чтения.');
      return;
    }
    if (onSave(mode, amount)) onClose();
    else setError('Не удалось обновить прогресс цели.');
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onEscape={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onBackdropClick={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onPanelClick={(event) => {
        if (!keyboardOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
        setKeyboardOpen(false);
      }}
      ariaLabel={`Обновить прогресс: ${goal.name}`}
      panelClassName="overflow-y-auto no-scrollbar"
      panelStyle={{ maxHeight: '86dvh' }}
    >
      <div className="px-6 pb-7">
        <div className="mb-5 pr-9">
          <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">Обновить прогресс</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{goal.name}</p>
        </div>

        <div className="mb-4 rounded-2xl neu-inset p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Отслеживается</span>
            <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">{formatCurrency(goal.currentAmount)} ₽</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Цель</span>
            <span className="text-sm tabular-nums text-neutral-700 dark:text-neutral-200">{formatCurrency(goal.targetAmount)} ₽</span>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl neu-inset p-1">
          <button
            type="button"
            aria-pressed={mode === 'add'}
            onClick={() => { setMode('add'); setAmountDigits(''); setError(''); }}
            disabled={remaining <= 0}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'add' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950' : 'text-neutral-500 dark:text-neutral-300'}`}
          >
            <ArrowUpRight className="h-4 w-4" />Добавить
          </button>
          <button
            type="button"
            aria-pressed={mode === 'reduce'}
            onClick={() => { setMode('reduce'); setAmountDigits(''); setError(''); }}
            disabled={goal.currentAmount <= 0}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'reduce' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950' : 'text-neutral-500 dark:text-neutral-300'}`}
          >
            <ArrowDownRight className="h-4 w-4" />Уменьшить
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Сумма, ₽</label>
          <div className="rounded-2xl neu-inset px-3 py-2">
            <div className="flex items-baseline justify-center gap-1">
              <AmountTrigger
                value={amountDigits}
                onChange={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
                keyboardOpen={keyboardOpen}
                onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
                onOpenKeyboard={() => setKeyboardOpen(true)}
                onCloseKeyboard={() => setKeyboardOpen(false)}
                label="Сумма обновления прогресса"
                keyboardId="goal-progress-keyboard"
                showCurrency={false}
                showZeroPlaceholder
              />
              <span className="text-xl font-light text-neutral-500 dark:text-neutral-400">₽</span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">Доступно для действия: {formatCurrency(available)} ₽</p>
        </div>

        <div className="mt-4 rounded-2xl bg-indigoblue/10 p-3 text-xs leading-relaxed text-neutral-600 dark:bg-indigoblue/10 dark:text-neutral-300">
          Это меняет только показатель прогресса цели. Остатки счетов и история операций не меняются. Для реального перемещения денег используйте «Перевод» в Кошельке.
        </div>

        {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-red-500">{error}</p>}

        {keyboardOpen ? (
          <div className="mt-4 space-y-3 animate-fade-in">
            <AmountKeyboard
              id="goal-progress-keyboard"
              value={amountDigits}
              onChange={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
              onClose={() => setKeyboardOpen(false)}
              label="Сумма изменения прогресса"
              replaceOnFirstDigit
            />
            <button type="button" onClick={() => setKeyboardOpen(false)} className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-mint to-indigoblue text-sm font-semibold text-white">
              <Check className="mr-2 inline h-4 w-4" />Готово
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={!canWrite || available <= 0}
            className="mt-5 min-h-12 w-full rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 text-sm font-semibold text-white transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mode === 'add' ? 'Добавить в прогресс' : 'Уменьшить прогресс'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
