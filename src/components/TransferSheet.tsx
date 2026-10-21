import { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeftRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Account } from '@/data/accounts';
import { formatCurrency } from '@/data/mockData';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import type { TransferInput } from '@/hooks/useTransactions';

interface TransferSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  accountBalances: Record<string, number>;
  onTransfer: (data: TransferInput) => void;
  defaultFromAccountId?: string;
}

export function TransferSheet({
  open,
  onClose,
  accounts,
  accountBalances,
  onTransfer,
  defaultFromAccountId,
}: TransferSheetProps) {
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);

  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [amountDigits, setAmountDigits] = useState('');
  const [comment, setComment] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const initialFrom = defaultFromAccountId && activeAccounts.some((a) => a.id === defaultFromAccountId)
        ? defaultFromAccountId
        : activeAccounts[0]?.id || '';
      const initialTo = activeAccounts.find((a) => a.id !== initialFrom)?.id || '';

      setFromId(initialFrom);
      setToId(initialTo);
      setAmountDigits('');
      setComment('');
      setKeyboardOpen(false);
      setError('');
    }
  }, [open, defaultFromAccountId, activeAccounts]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const fromAccount = activeAccounts.find((a) => a.id === fromId);
  const toAccount = activeAccounts.find((a) => a.id === toId);

  const fromBalance = fromAccount ? (accountBalances[fromAccount.id] ?? fromAccount.initialBalance) : 0;
  const toBalance = toAccount ? (accountBalances[toAccount.id] ?? toAccount.initialBalance) : 0;

  const transferAmount = parseInt(amountDigits || '0', 10) || 0;
  const newFromBalance = fromBalance - transferAmount;
  const newToBalance = toBalance + transferAmount;

  const handleSwap = () => {
    if (fromId && toId) {
      setFromId(toId);
      setToId(fromId);
    }
  };

  const handleTransfer = () => {
    if (!fromId || !toId) {
      setError('Выберите счета списания и зачисления');
      return;
    }
    if (fromId === toId) {
      setError('Нельзя перевести на тот же самый счёт');
      return;
    }
    if (transferAmount <= 0) {
      setError('Введите сумму перевода');
      return;
    }

    onTransfer({
      fromAccountId: fromId,
      toAccountId: toId,
      amount: transferAmount,
      fromAccountName: fromAccount?.name,
      toAccountName: toAccount?.name,
      comment: comment.trim() || undefined,
    });

    onClose();
  };

  if (!open) return null;

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

      {/* Sheet */}
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Перевод между счетами
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Внутреннее перемещение средств без влияния на доходы и расходы
            </p>
          </div>

          {/* Amount Input */}
          <div className="mb-5 flex flex-col items-center rounded-2xl neu-inset p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Сумма перевода
            </span>
            <div className="flex items-baseline justify-center">
              <AmountTrigger
                value={amountDigits}
                onChange={(val) => {
                  setAmountDigits(val);
                  if (error) setError('');
                }}
                keyboardOpen={keyboardOpen}
                onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
                onOpenKeyboard={() => setKeyboardOpen(true)}
                onCloseKeyboard={() => setKeyboardOpen(false)}
                label="Сумма перевода"
                keyboardId="transfer-amount-keyboard"
                showZeroPlaceholder
              />
            </div>
          </div>

          {keyboardOpen && (
            <div className="mb-4">
              <AmountKeyboard
                id="transfer-amount-keyboard"
                value={amountDigits}
                onChange={(val) => {
                  setAmountDigits(val);
                  if (error) setError('');
                }}
                onClose={() => setKeyboardOpen(false)}
                label="Клавиатура суммы перевода"
                replaceOnFirstDigit
              />
            </div>
          )}

          {/* Accounts Selector Section */}
          <div className="mb-4 space-y-2">
            {/* From Account */}
            <div className="rounded-2xl neu-card-sm p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                <span>Откуда списать</span>
                <span>Баланс: {formatCurrency(fromBalance)} ₽</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={fromId}
                  onChange={(e) => {
                    setFromId(e.target.value);
                    if (e.target.value === toId) {
                      const other = activeAccounts.find((a) => a.id !== e.target.value)?.id || '';
                      setToId(other);
                    }
                  }}
                  className="w-full rounded-xl bg-neutral-100 p-2.5 text-sm font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-mint/50 dark:bg-neutral-800 dark:text-white"
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(accountBalances[a.id] ?? a.initialBalance)} ₽)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1 relative z-10">
              <button
                type="button"
                onClick={handleSwap}
                className="flex h-8 w-8 items-center justify-center rounded-full neu-card text-neutral-500 shadow-sm transition-transform active:scale-90 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                aria-label="Поменять счета местами"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* To Account */}
            <div className="rounded-2xl neu-card-sm p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                <span>Куда зачислить</span>
                <span>Баланс: {formatCurrency(toBalance)} ₽</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={toId}
                  onChange={(e) => {
                    setToId(e.target.value);
                    if (e.target.value === fromId) {
                      const other = activeAccounts.find((a) => a.id !== e.target.value)?.id || '';
                      setFromId(other);
                    }
                  }}
                  className="w-full rounded-xl bg-neutral-100 p-2.5 text-sm font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-mint/50 dark:bg-neutral-800 dark:text-white"
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === fromId}>
                      {a.name} ({formatCurrency(accountBalances[a.id] ?? a.initialBalance)} ₽)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Comment input */}
          <div className="mb-4">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-xl bg-neutral-100 px-3.5 py-2.5 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-mint/50 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          {/* Balance Preview */}
          {transferAmount > 0 && fromAccount && toAccount && (
            <div className="mb-5 rounded-xl bg-neutral-100/70 p-3 text-xs dark:bg-neutral-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Итоговый баланс после перевода:
              </p>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-neutral-600 dark:text-neutral-400">{fromAccount.name}:</span>
                <span className={`font-medium tabular-nums ${newFromBalance < 0 ? 'text-red-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
                  {formatCurrency(newFromBalance)} ₽
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-neutral-600 dark:text-neutral-400">{toAccount.name}:</span>
                <span className="font-medium tabular-nums text-mint">
                  {formatCurrency(newToBalance)} ₽
                </span>
              </div>
              {newFromBalance < 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-500 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Внимание: баланс счёта станет отрицательным</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleTransfer}
            disabled={transferAmount <= 0 || !fromId || !toId || fromId === toId}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100 shadow-sm"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {transferAmount > 0 ? `Перевести ${formatCurrency(transferAmount)} ₽` : 'Введите сумму'}
          </button>
        </div>
      </div>
    </>
  );
}
