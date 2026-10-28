import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Minus, Trash2, User, Wallet } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  initialBalance: number;
  onUpdateName: (name: string) => void;
  onUpdateInitialBalance: (balance: number) => void;
  onResetData: () => void;
}

export function ProfileSheet({
  open,
  onClose,
  userName,
  initialBalance,
  onUpdateName,
  onUpdateInitialBalance,
  onResetData,
}: ProfileSheetProps) {
  const [nameInput, setNameInput] = useState(userName);
  const [balanceInput, setBalanceInput] = useState(String(Math.abs(initialBalance)));
  const [isNegative, setIsNegative] = useState(initialBalance < 0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!open) return;

    setNameInput(userName);
    setBalanceInput(String(Math.abs(initialBalance)));
    setIsNegative(initialBalance < 0);
    setConfirmReset(false);
    setHasChanges(false);
  }, [open, userName, initialBalance]);

  const handleNameChange = (value: string) => {
    setNameInput(value);
    setHasChanges(true);
  };

  const handleBalanceChange = (value: string) => {
    setBalanceInput(value.replace(/\D/g, '').slice(0, 12));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateName(nameInput);
    const parsed = parseInt(balanceInput || '0', 10);
    if (Number.isFinite(parsed)) {
      onUpdateInitialBalance(Math.round(parsed) * (isNegative ? -1 : 1));
    }
    setHasChanges(false);
    onClose();
  };

  const handleReset = () => {
    onResetData();
    setConfirmReset(false);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="Профиль и настройки"
      panelClassName="overflow-hidden"
      panelStyle={{ height: '62vh' }}
    >
      <div className="flex h-full flex-col px-6 pb-8">
        <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
          Профиль и настройки
        </h2>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          Измените имя и начальный баланс
        </p>

        <div className="mt-5">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            <User className="h-3 w-3" />
            Имя
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Введите имя"
            className="w-full rounded-xl neu-inset px-4 py-3 text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-300 dark:text-white dark:placeholder:text-neutral-700"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            <Wallet className="h-3 w-3" />
            Начальный баланс
          </label>
          <div className="flex items-center rounded-xl neu-inset px-4 py-3">
            {isNegative && <span className="mr-1 text-sm font-medium text-red-500 dark:text-red-400">−</span>}
            <input
              type="text"
              inputMode="numeric"
              value={balanceInput ? formatCurrency(parseInt(balanceInput, 10)) : ''}
              onChange={(event) => handleBalanceChange(event.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-sm font-medium tabular-nums text-neutral-900 outline-none placeholder:text-neutral-300 dark:text-white dark:placeholder:text-neutral-700"
            />
            <span className="ml-2 text-sm text-neutral-400 dark:text-neutral-500">₽</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNegative((value) => !value);
              setHasChanges(true);
            }}
            aria-pressed={isNegative}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              isNegative
                ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                : 'neu-inset text-neutral-500 dark:text-neutral-400'
            }`}
          >
            <Minus className="h-3 w-3" />
            {isNegative ? 'Отрицательный баланс' : 'Сделать отрицательным'}
          </button>
        </div>

        <div className="flex-1" />

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mb-3 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-red-500 transition-all duration-200 active:scale-[0.98] gpu dark:text-red-400"
            style={{ background: 'rgba(239, 68, 68, 0.08)' }}
          >
            <Trash2 className="h-4 w-4" />
            Сбросить все данные
          </button>
        ) : (
          <div className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
            <div className="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Удалить все транзакции?
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              Это действие необратимо. Все транзакции будут удалены.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl py-2 text-xs font-medium text-neutral-500 neu-inset transition-transform active:scale-95 gpu dark:text-neutral-400"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-xl py-2 text-xs font-semibold text-white transition-transform active:scale-95 gpu"
                style={{ background: 'rgb(239 68 68)' }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Сохранить
        </button>
      </div>
    </BottomSheet>
  );
}
