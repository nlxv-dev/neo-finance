import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import type { Account, AccountType } from '@/data/accounts';
import { ACCOUNT_TYPE_LABELS, MAIN_ACCOUNT_ID } from '@/data/accounts';
import { formatCurrency, type Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/data/categories';
import type { AccountInput } from '@/hooks/useAccounts';
import { IconRenderer } from '@/components/IconRenderer';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { AccountEditSheet } from '@/components/AccountEditSheet';

import { filterTransactionsForAccount, summarizeTransactions } from '@/utils/accountAnalytics';
import { formatISODateShort, resolveTransactionDateISO } from '@/data/transactionDates';
import { getCurrencySymbol } from '@/utils/currency';

const currencySymbol = getCurrencySymbol;

function accountColorClass(color?: string): string {
  switch (color) {
    case 'mint': return 'bg-mint/15 text-mint';
    case 'indigoblue':
    case 'cobalt': return 'bg-indigoblue/15 text-indigoblue';
    default: return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
  }
}

function formatAccountType(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type] ?? 'Счёт';
}

function formatAccountCount(count: number): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} активных счетов`;
  const mod10 = count % 10;
  if (mod10 === 1) return `${count} активный счёт`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} активных счёта`;
  return `${count} активных счетов`;
}

interface WalletScreenProps {
  accounts: Account[];
  transactions: Transaction[];
  accountBalances: Record<string, number>;
  balancesByCurrency: Record<string, number>;
  categories: CustomCategory[];
  onAddAccount: (input: AccountInput) => void;
  onUpdateAccount: (id: string, updates: Partial<AccountInput>) => void;
  onSetAccountArchived: (id: string, archived: boolean) => void;
  onRequestTransfer: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
  canWriteAccounts: boolean;
}

export function WalletScreen({
  accounts,
  transactions,
  accountBalances,
  balancesByCurrency,
  categories,
  onAddAccount,
  onUpdateAccount,
  onSetAccountArchived,
  onRequestTransfer,
  onSelectTransaction,
  canWriteAccounts,
}: WalletScreenProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const archivedAccounts = useMemo(() => accounts.filter((account) => account.isArchived), [accounts]);
  const archivedRubAccounts = useMemo(
    () => archivedAccounts.filter((account) => account.currency.toUpperCase() === 'RUB'),
    [archivedAccounts],
  );
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const knownAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const selectedAccount = selectedAccountId ? accountById.get(selectedAccountId) ?? null : null;
  const selectedTransactions = useMemo(
    () => selectedAccount ? filterTransactionsForAccount(transactions, selectedAccount.id, knownAccountIds) : transactions,
    [selectedAccount, transactions, knownAccountIds],
  );
  const selectedSummary = useMemo(
    () => selectedAccount ? summarizeTransactions(selectedTransactions) : null,
    [selectedAccount, selectedTransactions],
  );
  const otherCurrencies = Object.keys(balancesByCurrency)
    .filter((currency) => currency !== 'RUB' && accounts.some((account) => account.currency.toUpperCase() === currency))
    .sort();
  const hasTransferPair = activeAccounts.some((source) =>
    activeAccounts.some((destination) =>
      source.id !== destination.id && source.currency.toUpperCase() === destination.currency.toUpperCase()
    )
  );

  const openAddAccount = () => {
    setEditingAccount(null);
    setIsAccountSheetOpen(true);
  };

  const openEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountSheetOpen(true);
  };

  const handleSaveAccount = (input: AccountInput) => {
    if (editingAccount) onUpdateAccount(editingAccount.id, input);
    else onAddAccount(input);
  };

  return (
    <div className="px-5 pb-12 pt-12">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">Кошелёк</h1>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {formatAccountCount(activeAccounts.length)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestTransfer}
              disabled={!canWriteAccounts || !hasTransferPair}
              title={!hasTransferPair ? 'Нужны два активных счёта в одной валюте' : 'Перевести деньги между счетами'}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full neu-card-sm px-3 text-xs font-semibold text-neutral-700 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Перевод
            </button>
            <button
              type="button"
              onClick={openAddAccount}
              disabled={!canWriteAccounts}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full neu-card-sm px-3 text-xs font-semibold text-neutral-700 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200"
            >
              <Plus className="h-4 w-4" />
              Новый счёт
            </button>
          </div>
        </div>
        {!hasTransferPair && (
          <p className="mt-2 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Для перевода добавьте ещё один активный счёт в той же валюте.
          </p>
        )}

        <section className="mt-4 rounded-3xl neu-card p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">
            Баланс в рублях
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <h2 className="text-[clamp(2rem,9vw,2.75rem)] font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
              <AnimatedCounter value={balancesByCurrency.RUB ?? 0} />
            </h2>
            <span className="text-xl font-light text-neutral-500 dark:text-neutral-400">₽</span>
          </div>
          <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
            {archivedRubAccounts.length > 0 ? 'Включая архивные счета в RUB' : 'Сумма счетов в RUB'}
          </p>

          {otherCurrencies.length > 0 && (
            <div className="mt-4 border-t border-neutral-200/60 pt-3 dark:border-neutral-800/70">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Другие валюты — отдельно
              </p>
              <div className="grid grid-cols-2 gap-2">
                {otherCurrencies.map((currency) => (
                  <div key={currency} className="rounded-xl neu-inset px-3 py-2.5">
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{currency}</p>
                    <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-neutral-800 dark:text-neutral-100">
                      {formatCurrency(balancesByCurrency[currency] ?? 0)} {currencySymbol(currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </header>

      {!canWriteAccounts && (
        <div role="status" className="mb-5 rounded-2xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Хранилище счетов доступно только для чтения. Сначала устраните проблему восстановления данных в уведомлении приложения.
        </div>
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Ваши счета</h2>
          {selectedAccountId && (
            <button type="button" onClick={() => setSelectedAccountId(null)} className="min-h-8 rounded-full px-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              Показать все
            </button>
          )}
        </div>
        {activeAccounts.length === 0 ? (
          <div className="rounded-2xl neu-card px-4 py-8 text-center">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Нет активных счетов</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Верните счёт из архива или создайте новый.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={accountBalances[account.id] ?? account.initialBalance}
                selected={selectedAccountId === account.id}
                onSelect={() => setSelectedAccountId((current) => current === account.id ? null : account.id)}
                onEdit={() => openEditAccount(account)}
                canWrite={canWriteAccounts}
              />
            ))}
          </div>
        )}
      </section>

      {archivedAccounts.length > 0 && (
        <section className="mb-6">
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl neu-inset px-4 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              <Archive className="h-4 w-4" />
              Архивные счета
              <span className="text-xs text-neutral-400">{archivedAccounts.length}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
          </button>
          {showArchived && (
            <div className="mt-3 space-y-3">
              {archivedAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  balance={accountBalances[account.id] ?? account.initialBalance}
                  selected={selectedAccountId === account.id}
                  archived
                  onSelect={() => setSelectedAccountId((current) => current === account.id ? null : account.id)}
                  onEdit={() => openEditAccount(account)}
                  canWrite={canWriteAccounts}
                  onRestore={() => onSetAccountArchived(account.id, false)}
                />
              ))}
              <p className="px-1 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Архивные счета скрыты из активного списка, но их баланс продолжает учитываться в сумме по соответствующей валюте.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedAccount && selectedSummary && (
        <section className="mb-6 rounded-3xl neu-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Аналитика счёта</p>
              <h3 className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{selectedAccount.name}</h3>
              <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">За всё время · {selectedSummary.count} операций</p>
            </div>
            <span className="rounded-full neu-inset px-2.5 py-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              {selectedAccount.currency}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <MetricCard label="Доходы" value={selectedSummary.income} currency={selectedAccount.currency} positive icon="income" />
            <MetricCard label="Расходы" value={selectedSummary.expenses} currency={selectedAccount.currency} icon="expense" />
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-xl neu-inset px-3.5 py-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Чистый поток</span>
            <span className={`text-sm font-semibold tabular-nums ${selectedSummary.net > 0 ? 'text-mint' : selectedSummary.net < 0 ? 'text-red-500 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-200'}`}>
              {selectedSummary.net > 0 ? '+' : selectedSummary.net < 0 ? '−' : ''}{formatCurrency(Math.abs(selectedSummary.net))} {currencySymbol(selectedAccount.currency)}
            </span>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {selectedAccount ? `Операции · ${selectedAccount.name}` : 'История операций'}
          </h2>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{selectedTransactions.length}</span>
        </div>
        {selectedTransactions.length === 0 ? (
          <div className="rounded-2xl neu-card px-4 py-8 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-neutral-300 dark:text-neutral-600" />
            <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">Пока нет операций</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {selectedAccount ? `Новые операции для «${selectedAccount.name}» появятся здесь.` : 'Здесь отображается история по всем счетам.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedTransactions.slice(0, 15).map((transaction) => {
              const accountId = transaction.accountId?.trim() || MAIN_ACCOUNT_ID;
              const account = accountById.get(accountId);
              const category = categories.find((item) => item.id === transaction.categoryId);
              const categoryName = category?.name ?? transaction.category ?? 'Без категории';
              const categoryIcon = category?.iconName ?? transaction.categoryIconName ?? 'HelpCircle';
              const dateISO = resolveTransactionDateISO(transaction);
              const dateText = dateISO ? formatISODateShort(dateISO) : transaction.date;
              const isIncome = transaction.isIncome;
              const isTransfer = transaction.isTransfer === true;
              const destinationAccount = transaction.toAccountId ? accountById.get(transaction.toAccountId) : undefined;
              const symbol = currencySymbol(account?.currency ?? 'RUB');

              return (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => onSelectTransaction(transaction)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl neu-card-sm p-3 text-left transition-transform active:scale-[0.99]"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isTransfer ? 'bg-indigoblue/10 text-indigoblue dark:text-indigo-300' : isIncome ? 'bg-mint/10 text-mint' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                    {isTransfer ? <ArrowLeftRight className="h-5 w-5" aria-hidden="true" /> : <IconRenderer name={categoryIcon} className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{isTransfer ? 'Перевод между счетами' : transaction.title || categoryName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                      {isTransfer
                        ? `${account?.name ?? 'Счёт'} → ${destinationAccount?.name ?? 'Счёт'} · ${dateText}`
                        : `${categoryName} · ${account?.name ?? 'Основной счёт'} · ${dateText}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${isTransfer ? 'text-neutral-600 dark:text-neutral-300' : isIncome ? 'text-mint' : 'text-neutral-900 dark:text-white'}`}>
                      {isTransfer ? '' : isIncome ? '+' : '−'}{formatCurrency(transaction.amount)} {symbol}
                    </p>
                  </div>
                </button>
              );
            })}
            {selectedTransactions.length > 15 && (
              <p className="pt-2 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                Показаны последние 15 из {selectedTransactions.length} операций.
              </p>
            )}
          </div>
        )}
      </section>

      <AccountEditSheet
        open={isAccountSheetOpen}
        onClose={() => setIsAccountSheetOpen(false)}
        account={editingAccount}
        onSave={handleSaveAccount}
        onSetArchived={onSetAccountArchived}
        canWrite={canWriteAccounts}
      />
    </div>
  );
}

function AccountCard({
  account,
  balance,
  selected,
  archived = false,
  onSelect,
  onEdit,
  canWrite,
  onRestore,
}: {
  account: Account;
  balance: number;
  selected: boolean;
  archived?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  canWrite: boolean;
  onRestore?: () => void;
}) {
  return (
    <div className={`rounded-2xl p-3 transition-colors ${selected ? 'neu-card ring-1 ring-indigoblue/35' : 'neu-card-sm'} ${archived ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left "
        >
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accountColorClass(account.color)}`}>
            <IconRenderer name={account.iconName} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{account.name}</p>
            <p className="mt-0.5 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
              {formatAccountType(account.type)}{archived ? ' · В архиве' : ''}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={!canWrite}
          aria-label={`Настроить счёт «${account.name}»`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl neu-inset text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-40 dark:text-neutral-400 dark:hover:text-white"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      <button type="button" onClick={onSelect} className="mt-3 flex w-full items-end justify-between rounded-xl px-1 text-left" aria-pressed={selected}>
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Баланс</span>
        <span className="text-lg font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
          {formatCurrency(balance)} <span className="text-sm text-neutral-500 dark:text-neutral-400">{currencySymbol(account.currency)}</span>
        </span>
      </button>
      {archived && (
        <button
          type="button"
          onClick={onRestore ?? onEdit}
          disabled={!canWrite}
          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl neu-inset text-xs font-medium text-neutral-600 disabled:opacity-40 dark:text-neutral-300"
        >
          <ArchiveRestore className="h-4 w-4" /> Вернуть из архива
        </button>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  currency,
  positive = false,
  icon,
}: {
  label: string;
  value: number;
  currency: string;
  positive?: boolean;
  icon: 'income' | 'expense';
}) {
  return (
    <div className="rounded-xl neu-inset p-3">
      <div className={`flex items-center gap-1.5 ${positive ? 'text-mint' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {icon === 'income' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
        {positive ? '+' : value > 0 ? '−' : ''}{formatCurrency(value)} {currencySymbol(currency)}
      </p>
    </div>
  );
}
