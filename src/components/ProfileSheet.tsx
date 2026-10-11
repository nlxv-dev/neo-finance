import { useState, useRef, useEffect } from 'react';
import { X, Check, User, Wallet, Trash2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';

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
  const [balanceInput, setBalanceInput] = useState(String(initialBalance));
  const [confirmReset, setConfirmReset] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNameInput(userName);
      setBalanceInput(String(initialBalance));
      setConfirmReset(false);
      setHasChanges(false);
      const timer = setTimeout(() => nameRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [open, userName, initialBalance]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setNameInput(value);
    setHasChanges(true);
  };

  const handleBalanceChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    setBalanceInput(digits);
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateName(nameInput);
    const parsed = parseInt(balanceInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateInitialBalance(parsed);
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
        style={{ height: '62vh' }}
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
            Профиль и настройки
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Измените имя и начальный баланс
          </p>

          {/* Name field */}
          <div className="mt-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <User className="h-3 w-3" />
              Имя
            </label>
            <input
              ref={nameRef}
              type="text"
              value={nameInput}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Введите имя"
              className="w-full rounded-xl neu-inset px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
            />
          </div>

          {/* Initial balance field */}
          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <Wallet className="h-3 w-3" />
              Начальный баланс
            </label>
            <div className="flex items-center rounded-xl neu-inset px-4 py-3">
              <input
                type="text"
                inputMode="numeric"
                value={balanceInput ? formatCurrency(parseInt(balanceInput, 10)) : ''}
                onChange={(e) => handleBalanceChange(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-sm font-medium text-neutral-900 dark:text-white tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              />
              <span className="ml-2 text-sm text-neutral-400 dark:text-neutral-500">₽</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset data section */}
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-red-500 dark:text-red-400 transition-all duration-200 active:scale-[0.98] gpu mb-3"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
              }}
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
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 rounded-xl py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 neu-inset transition-transform active:scale-95 gpu"
                >
                  Отмена
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-xl py-2 text-xs font-semibold text-white transition-transform active:scale-95 gpu"
                  style={{ background: 'rgb(239 68 68)' }}
                >
                  Удалить
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}
