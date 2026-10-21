import { useState, useMemo } from 'react';
import {
  Plus,
  ArrowLeftRight,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import type { Account } from '@/data/accounts';
import { ACCOUNT_TYPE_LABELS } from '@/data/accounts';
import type { Transaction } from '@/data/mockData';
import { formatCurrency } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import { IconRenderer } from '@/components/IconRenderer';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import {
  calculateAllAccountBalances,
  calculateTotalBalance,
} from '@/utils/financialMath';
import { resolveTransactionDateISO, formatISODateShort } from '@/data/transactionDates';
import { AccountEditSheet } from '@/components/AccountEditSheet';
import { TransferSheet } from '@/components/TransferSheet';
import type { AccountInput } from '@/hooks/useAccounts';
import type { TransferInput } from '@/hooks/useTransactions';

interface WalletScreenProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: CustomCategory[];
  onAddAccount: (input: AccountInput) => void;
  onUpdateAccount: (id: string, updates: Partial<AccountInput>) => void;
  onDeleteAccount: (id: string, isUsed: boolean) => void;
  onTransfer: (data: TransferInput) => void;
  onSelectTransaction: (tx: Transaction) => void;
  fallbackInitialBalance?: number;
}

export function WalletScreen({
  accounts,
  transactions,
  categories,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTransfer,
  onSelectTransaction,
  fallbackInitialBalance = 0,
}: WalletScreenProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<string | undefined>(undefined);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);
  const primaryAccountId = activeAccounts[0]?.id ?? accounts[0]?.id ?? 'acc-main';

  // Balances computed accurately
  const accountBalances = useMemo(
    () => calculateAllAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const totalBalance = useMemo(
    () => calculateTotalBalance(accounts, transactions, fallbackInitialBalance),
    [accounts, transactions, fallbackInitialBalance]
  );

  // Selected account object
  const selectedAccount = useMemo(
    () => (selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) ?? null : null),
    [selectedAccountId, accounts]
  );

  // Filtered transactions for the selected account (or all)
  const filteredTransactions = useMemo(() => {
    if (!selectedAccountId) return transactions;
    return transactions.filter((tx) => {
      if (tx.isTransfer) {
        return tx.accountId === selectedAccountId || tx.toAccountId === selectedAccountId;
      }
      return (
        tx.accountId === selectedAccountId ||
        (selectedAccountId === primaryAccountId && (!tx.accountId || tx.accountId === ''))
      );
    });
  }, [transactions, selectedAccountId, primaryAccountId]);

  // Account specific analytics
  const accountStats = useMemo(() => {
    if (!selectedAccountId) return null;
    let income = 0;
    let expenses = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const tx of transactions) {
      if (tx.isTransfer) {
        if (tx.accountId === selectedAccountId) transferOut += tx.amount;
        if (tx.toAccountId === selectedAccountId) transferIn += tx.amount;
      } else {
        const matches =
          tx.accountId === selectedAccountId ||
          (selectedAccountId === primaryAccountId && (!tx.accountId || tx.accountId === ''));
        if (matches) {
          if (tx.isIncome) income += tx.amount;
          else expenses += tx.amount;
        }
      }
    }

    return { income, expenses, transferIn, transferOut };
  }, [selectedAccountId, transactions, primaryAccountId]);

  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setIsEditSheetOpen(true);
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setIsEditSheetOpen(true);
  };

  const handleOpenTransfer = (sourceId?: string) => {
    setTransferSourceId(sourceId);
    setIsTransferSheetOpen(true);
  };

  const isAccountUsedInTransactions = (accId: string) => {
    return transactions.some(
      (tx) => tx.accountId === accId || tx.toAccountId === accId
    );
  };

  return (
    <div className="px-5 pt-12 pb-12 animate-fade-in">
      {/* Top Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            Кошелёк
          </h1>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {activeAccounts.length}{' '}
            {activeAccounts.length === 1 ? 'счёт' : activeAccounts.length < 5 ? 'счёта' : 'счетов'}
          </span>
        </div>

        {/* Global Total Balance Card */}
        <div className="mt-4 rounded-3xl neu-card p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
            Совокупный баланс всех счетов
          </p>
          <div className="mt-2 flex items-baseline">
            <h2 className="text-4xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
              <AnimatedCounter value={totalBalance} />
            </h2>
            <span className="ml-1.5 text-2xl text-neutral-400 dark:text-neutral-500">₽</span>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOpenTransfer(selectedAccountId ?? undefined)}
              disabled={activeAccounts.length < 2}
              className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:text-neutral-900"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>Перевод</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddAccount}
              className="flex items-center justify-center gap-2 rounded-2xl neu-inset py-3 text-xs font-semibold text-neutral-700 transition-all active:scale-95 dark:text-neutral-200"
            >
              <Plus className="h-4 w-4" />
              <span>Новый счёт</span>
            </button>
          </div>
        </div>
      </header>

      {/* Accounts Horizontal Filter & Overview */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Ваши счета
          </h2>
          {selectedAccountId && (
            <button
              type="button"
              onClick={() => setSelectedAccountId(null)}
              className="text-xs text-mint hover:underline dark:text-mint"
            >
              Показать все
            </button>
          )}
        </div>

        {/* Account Cards Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeAccounts.map((account) => {
            const balance = accountBalances[account.id] ?? account.initialBalance;
            const isSelected = selectedAccountId === account.id;

            return (
              <div
                key={account.id}
                className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'neu-card ring-2 ring-mint'
                    : 'neu-card-sm hover:translate-y-[-2px]'
                }`}
                onClick={() => setSelectedAccountId((prev) => (prev === account.id ? null : account.id))}
              >
                {/* Header of card: Icon + Name + Edit button */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        account.color === 'mint'
                          ? 'bg-mint/15 text-mint'
                          : account.color === 'indigoblue'
                            ? 'bg-indigoblue/15 text-indigoblue'
                            : account.color === 'cobalt'
                              ? 'bg-cobalt/15 text-cobalt'
                              : account.color === 'amber'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-purple-500/15 text-purple-500'
                      }`}
                    >
                      <IconRenderer name={account.iconName} className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
                        {account.name}
                      </h3>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {ACCOUNT_TYPE_LABELS[account.type] || 'Счёт'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditAccount(account);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 active:scale-90 dark:hover:bg-neutral-800 dark:hover:text-white"
                    aria-label={`Редактировать счёт ${account.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Balance display */}
                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      Баланс
                    </span>
                    <p className="text-xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
                      {formatCurrency(balance)}{' '}
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">
                        {account.currency === 'USD' ? '$' : account.currency === 'EUR' ? '€' : '₽'}
                      </span>
                    </p>
                  </div>

                  {/* Transfer shortcut button on card */}
                  {activeAccounts.length >= 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTransfer(account.id);
                      }}
                      className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                      Перевести
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Selected Account Deep-Dive Statistics (if an account is selected) */}
      {selectedAccount && accountStats && (
        <section className="mb-6 rounded-3xl neu-card p-5 animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Аналитика: {selectedAccount.name}
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Поступления и списания по выбранному счёту
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAccountId(null)}
              className="text-xs font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              Сбросить
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl neu-inset p-3">
              <div className="flex items-center gap-1.5 text-mint">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Доходы</span>
              </div>
              <p className="mt-1 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
                +{formatCurrency(accountStats.income)} ₽
              </p>
            </div>

            <div className="rounded-2xl neu-inset p-3">
              <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <ArrowDownRight className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Расходы</span>
              </div>
              <p className="mt-1 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
                −{formatCurrency(accountStats.expenses)} ₽
              </p>
            </div>

            <div className="rounded-2xl neu-inset p-3">
              <div className="flex items-center gap-1.5 text-cobalt">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Переводы в</span>
              </div>
              <p className="mt-1 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
                +{formatCurrency(accountStats.transferIn)} ₽
              </p>
            </div>

            <div className="rounded-2xl neu-inset p-3">
              <div className="flex items-center gap-1.5 text-amber-500">
                <TrendingDown className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Переводы из</span>
              </div>
              <p className="mt-1 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
                −{formatCurrency(accountStats.transferOut)} ₽
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Account Transactions History */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {selectedAccount ? `Операции: ${selectedAccount.name}` : 'Все операции по счетам'}
          </h2>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {filteredTransactions.length} оп.
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-2xl neu-card px-4 py-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Пока нет операций
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {selectedAccount
                ? `По счёту «${selectedAccount.name}» ещё не было транзакций`
                : 'Совершайте покупки или переводы между счетами'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((tx) => {
              const dateISO = resolveTransactionDateISO(tx);
              const dateFormatted = dateISO ? formatISODateShort(dateISO) : tx.date;
              const sourceAcc = accounts.find((a) => a.id === tx.accountId);
              const destAcc = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;

              if (tx.isTransfer) {
                // If a specific account is selected, show if it is outgoing (-) or incoming (+)
                const isIncomingForSelected = selectedAccountId && tx.toAccountId === selectedAccountId;
                const sign = isIncomingForSelected ? '+' : '−';
                const signColor = isIncomingForSelected ? 'text-mint' : 'text-neutral-800 dark:text-neutral-200';

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    className="flex w-full items-center gap-3 rounded-2xl neu-card-sm p-3 text-left transition-transform active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigoblue/10 text-indigoblue">
                      <ArrowLeftRight className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {tx.title || 'Перевод между счетами'}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {sourceAcc?.name ?? 'Счёт'} → {destAcc?.name ?? 'Счёт'} · {dateFormatted}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium tabular-nums ${signColor}`}>
                        {sign}{formatCurrency(tx.amount)} ₽
                      </span>
                    </div>
                  </button>
                );
              }

              // Regular transaction
              const linkedCat = categories.find((c) => c.id === tx.categoryId);
              const catName = linkedCat?.name ?? tx.category ?? 'Без категории';
              const catIcon = linkedCat?.iconName ?? tx.categoryIconName ?? 'HelpCircle';
              const txAccount = sourceAcc ?? (activeAccounts[0]);

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectTransaction(tx)}
                  className="flex w-full items-center gap-3 rounded-2xl neu-card-sm p-3 text-left transition-transform active:scale-[0.98]"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      tx.isIncome
                        ? 'bg-mint/10 text-mint'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    <IconRenderer name={catIcon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {tx.title || catName}
                    </p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {catName} {txAccount ? `· ${txAccount.name}` : ''} · {dateFormatted}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        tx.isIncome ? 'text-mint' : 'text-neutral-900 dark:text-white'
                      }`}
                    >
                      {tx.isIncome ? '+' : '−'}
                      {formatCurrency(tx.amount)} ₽
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sheets */}
      <AccountEditSheet
        open={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        account={editingAccount}
        onSave={(data) => {
          if (editingAccount) {
            onUpdateAccount(editingAccount.id, data);
          } else {
            onAddAccount(data);
          }
        }}
        onDelete={(id) => {
          const isUsed = isAccountUsedInTransactions(id);
          onDeleteAccount(id, isUsed);
          if (selectedAccountId === id) setSelectedAccountId(null);
        }}
        isUsedInTransactions={editingAccount ? isAccountUsedInTransactions(editingAccount.id) : false}
        canDelete={activeAccounts.length > 1}
      />

      <TransferSheet
        open={isTransferSheetOpen}
        onClose={() => setIsTransferSheetOpen(false)}
        accounts={activeAccounts}
        accountBalances={accountBalances}
        onTransfer={onTransfer}
        defaultFromAccountId={transferSourceId}
      />
    </div>
  );
}
