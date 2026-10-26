import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import type { Account } from '@/data/accounts';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getCurrencySymbol } from '@/utils/currency';
import { formatCurrency } from '@/utils/formatters';

export interface TransferDraft {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
}

interface TransferSheetProps {
  open: boolean;
  accounts: Account[];
  accountBalances: Record<string, number>;
  canWrite: boolean;
  onClose: () => void;
  onSave: (transfer: TransferDraft) => boolean;
}

export function TransferSheet({
  open,
  accounts,
  accountBalances,
  canWrite,
  onClose,
  onSave,
}: TransferSheetProps) {
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountDigits, setAmountDigits] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const initialSource = activeAccounts.find((account) => account.id === 'acc-main') ?? activeAccounts[0];
    const initialDestination = initialSource
      ? activeAccounts.find((account) => account.id !== initialSource.id && account.currency.toUpperCase() === initialSource.currency.toUpperCase())
      : undefined;
    setFromAccountId(initialSource?.id ?? '');
    setToAccountId(initialDestination?.id ?? '');
    setAmountDigits('');
    setKeyboardOpen(false);
    setError('');
  }, [open, activeAccounts]);

  const sourceAccount = activeAccounts.find((account) => account.id === fromAccountId);
  const destinations = useMemo(
    () => sourceAccount
      ? activeAccounts.filter((account) => account.id !== sourceAccount.id && account.currency.toUpperCase() === sourceAccount.currency.toUpperCase())
      : [],
    [activeAccounts, sourceAccount],
  );

  useEffect(() => {
    if (destinations.some((account) => account.id === toAccountId)) return;
    setToAccountId(destinations[0]?.id ?? '');
  }, [destinations, toAccountId]);

  const destinationAccount = destinations.find((account) => account.id === toAccountId);
  const currency = sourceAccount?.currency ?? 'RUB';
  const symbol = getCurrencySymbol(currency);
  const parsedAmount = Number.parseInt(amountDigits || '0', 10) || 0;
  const canSubmit = canWrite && Number.isSafeInteger(parsedAmount) && parsedAmount > 0 &&
    Boolean(sourceAccount && destinationAccount && sourceAccount.id !== destinationAccount.id &&
      sourceAccount.currency.toUpperCase() === destinationAccount.currency.toUpperCase());

  const handleSourceChange = (nextId: string) => {
    setFromAccountId(nextId);
    setError('');
  };

  const handleSubmit = () => {
    if (!canSubmit || !sourceAccount || !destinationAccount) {
      setError(destinations.length === 0
        ? 'Нет второго активного счёта в этой валюте. Создайте ещё один счёт.'
        : 'Проверьте сумму и выбранные счета.');
      return;
    }
    const saved = onSave({ amount: parsedAmount, fromAccountId: sourceAccount.id, toAccountId: destinationAccount.id });
    if (!saved) {
      setError('Перевод не сохранён. Проверьте доступность хранилища и выбранные счета.');
      return;
    }
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

  if (!open) return null;

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
      ariaLabel="Перевод между счетами"
      panelClassName="overflow-y-auto no-scrollbar"
      panelStyle={{ maxHeight: '92dvh' }}
    >
      <div className="flex flex-col px-6 pb-6">
        <div className="mb-5 flex items-start justify-between gap-4 pr-10">
          <div>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">Перевод между счетами</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Перевод изменит остатки двух счетов, но не будет считаться доходом или расходом.
            </p>
          </div>
        </div>

        {activeAccounts.length < 2 ? (
          <div className="rounded-2xl neu-inset p-4">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Пока недостаточно счетов</p>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Создайте ещё один активный счёт. Переводы доступны между счетами в одной валюте.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-2xl neu-inset p-4">
              <label className="mb-2 block text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Сумма перевода
              </label>
              <div className="flex items-baseline justify-center">
                <AmountTrigger
                  value={amountDigits}
                  onChange={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
                  keyboardOpen={keyboardOpen}
                  onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
                  onOpenKeyboard={() => setKeyboardOpen(true)}
                  onCloseKeyboard={() => setKeyboardOpen(false)}
                  label={`Сумма перевода в ${currency}`}
                  keyboardId="transfer-amount-keyboard"
                  showCurrency={false}
                  showZeroPlaceholder
                />
                <span className="ml-1 text-xl font-light text-neutral-500 dark:text-neutral-400">{symbol}</span>
              </div>
              <p className="mt-2 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                Сумма не влияет на бюджет и статистику доходов/расходов.
              </p>
            </div>

            {!keyboardOpen && (
              <div className="space-y-3">
                <AccountSelect
                  label="Откуда"
                  value={fromAccountId}
                  accounts={activeAccounts}
                  accountBalances={accountBalances}
                  symbol={symbol}
                  onChange={handleSourceChange}
                />
                <div className="flex justify-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full neu-card-sm text-neutral-500 dark:text-neutral-300">
                    <ArrowDown className="h-4 w-4" />
                  </span>
                </div>
                {destinations.length > 0 ? (
                  <AccountSelect
                    label="Куда"
                    value={toAccountId}
                    accounts={destinations}
                    accountBalances={accountBalances}
                    symbol={symbol}
                    onChange={(value) => { setToAccountId(value); setError(''); }}
                  />
                ) : (
                  <div className="rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                    Нет другого активного счёта в {currency}. Переводы между разными валютами пока не поддерживаются.
                  </div>
                )}
              </div>
            )}

            {keyboardOpen && (
              <div className="space-y-3">
                <AmountKeyboard
                  id="transfer-amount-keyboard"
                  value={amountDigits}
                  onChange={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
                  onClose={() => setKeyboardOpen(false)}
                  label="Клавиатура суммы перевода"
                  replaceOnFirstDigit
                />
                <button
                  type="button"
                  onClick={() => setKeyboardOpen(false)}
                  className="min-h-12 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
                >
                  Готово
                </button>
              </div>
            )}

            {sourceAccount && destinationAccount && parsedAmount > 0 && !keyboardOpen && (
              <div className="mt-4 rounded-2xl neu-inset p-3.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-neutral-500 dark:text-neutral-400">{sourceAccount.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-white">
                    {formatCurrency((accountBalances[sourceAccount.id] ?? sourceAccount.initialBalance) - parsedAmount)} {symbol}
                  </span>
                </div>
                <div className="my-2 border-t border-neutral-200/60 dark:border-neutral-700/60" />
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-neutral-500 dark:text-neutral-400">{destinationAccount.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-white">
                    {formatCurrency((accountBalances[destinationAccount.id] ?? destinationAccount.initialBalance) + parsedAmount)} {symbol}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-red-500">{error}</p>}
        {!canWrite && <p role="status" className="mt-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">Изменение данных временно недоступно: проверьте уведомление о состоянии хранилища.</p>}

        {!keyboardOpen && (
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-2xl neu-card-sm px-4 text-sm font-medium text-neutral-600 dark:text-neutral-300"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Перевести
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function AccountSelect({
  label,
  value,
  accounts,
  accountBalances,
  symbol,
  onChange,
}: {
  label: string;
  value: string;
  accounts: Account[];
  accountBalances: Record<string, number>;
  symbol: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl neu-inset px-3 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-mint/50 dark:text-white"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {formatCurrency(accountBalances[account.id] ?? account.initialBalance)} {symbol}
          </option>
        ))}
      </select>
    </label>
  );
}
