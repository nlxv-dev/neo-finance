import { memo, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { IconRenderer } from '@/components/IconRenderer';
import { formatCurrency, type Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import type { Account } from '@/data/accounts';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import { getCurrencySymbol } from '@/utils/currency';

// Keep the Home screen compact by default. Users can progressively reveal
// older transactions in predictable batches without loading a long list at once.
const PAGE_SIZE = 10;
const MAX_ANIMATED_ROW = 8;
const ROW_ANIMATION_STEP_MS = 40;

type TransactionFilter = 'all' | 'income' | 'expense';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: CustomCategory[];
  onSelect?: (tx: Transaction) => void;
}

export const TransactionList = memo(function TransactionList({ transactions, accounts, categories, onSelect }: TransactionListProps) {
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const filtered = useMemo(
    () => transactions.filter((transaction) => {
      if (filter === 'income') return !transaction.isTransfer && transaction.isIncome;
      if (filter === 'expense') return !transaction.isTransfer && !transaction.isIncome;
      return true;
    }),
    [transactions, filter]
  );

  const visibleTransactions = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (nextFilter: TransactionFilter) => {
    setFilter(nextFilter);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Последние транзакции
        </h2>
        <div className="flex gap-1.5">
          {(['all', 'income', 'expense'] as const).map((filterType) => (
            <button
              key={filterType}
              type="button"
              onClick={() => handleFilterChange(filterType)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 ${
                filter === filterType
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                  : 'text-neutral-400 dark:text-neutral-500'
              }`}
            >
              {filterType === 'all' ? 'Все' : filterType === 'income' ? 'Доход' : 'Расход'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
            Нет транзакций
          </p>
        ) : (
          visibleTransactions.map((transaction, index) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categoryById={categoryById}
              accountById={accountById}
              index={index}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length))}
          className="mt-3 w-full rounded-2xl neu-inset py-3 text-xs font-medium text-neutral-500 transition-transform active:scale-[0.99] dark:text-neutral-400"
        >
          Показать ещё
          <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">
            {filtered.length - visibleCount}
          </span>
        </button>
      )}

      {filtered.length > PAGE_SIZE && (
        <p className="mt-2 text-center text-[10px] text-neutral-400 dark:text-neutral-600">
          Показано {visibleTransactions.length} из {filtered.length}
        </p>
      )}
    </div>
  );
});

const TransactionRow = memo(function TransactionRow({
  transaction,
  categoryById,
  accountById,
  index,
  onSelect,
}: {
  transaction: Transaction;
  categoryById: Map<string, CustomCategory>;
  accountById: Map<string, Account>;
  index: number;
  onSelect?: (tx: Transaction) => void;
}) {
  // Category IDs, not names, are the source of truth. The snapshot is a fallback
  // for older ambiguous records that cannot be mapped without guessing.
  const currentCategory = transaction.categoryId
    ? categoryById.get(transaction.categoryId)
    : undefined;
  const categoryName = currentCategory?.name ?? transaction.category;
  const categoryIcon = currentCategory?.iconName ?? transaction.categoryIconName ?? 'HelpCircle';
  const currencySymbol = getCurrencySymbol(accountById.get(transaction.accountId?.trim() || MAIN_ACCOUNT_ID)?.currency ?? 'RUB');
  const transferSource = accountById.get(transaction.accountId?.trim() || MAIN_ACCOUNT_ID);
  const transferDestination = transaction.toAccountId ? accountById.get(transaction.toAccountId) : undefined;
  const displayName = transaction.isTransfer ? 'Перевод между счетами' : categoryName;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(transaction)}
      className="w-full rounded-2xl neu-card-sm p-3 transition-transform active:scale-[0.98] text-left"
      aria-label={`Транзакция: ${categoryName}`}
    >
      <span
        className="flex w-full items-center gap-3 animate-slide-up"
        style={{ animationDelay: `${Math.min(index, MAX_ANIMATED_ROW) * ROW_ANIMATION_STEP_MS}ms` }}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            transaction.isTransfer
              ? 'bg-indigoblue/10 text-indigoblue dark:text-indigo-300'
              : transaction.isIncome
              ? 'bg-mint/10 dark:bg-mint/10'
              : 'bg-neutral-100 dark:bg-neutral-800/50'
          }`}
        >
          {transaction.isTransfer ? <ArrowLeftRight className="h-5 w-5" aria-hidden="true" /> : (
            <IconRenderer
              name={categoryIcon}
              className={`h-5 w-5 ${
                transaction.isIncome ? 'text-green-700 dark:text-mint' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
            {displayName}
          </p>
          <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
            {transaction.isTransfer
              ? `${transferSource?.name ?? 'Счёт'} → ${transferDestination?.name ?? 'Счёт'} · ${transaction.date}`
              : transaction.date}
          </p>
        </span>

        <span className="flex flex-col items-end">
          <span
            className={`flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
              transaction.isTransfer
                ? 'text-neutral-600 dark:text-neutral-300'
                : transaction.isIncome ? 'text-green-700 dark:text-mint' : 'text-neutral-900 dark:text-white'
            }`}
          >
            {transaction.isTransfer ? (
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : transaction.isIncome ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
            )}
            {formatCurrency(transaction.amount)} {currencySymbol}
          </span>
        </span>
      </span>
    </button>
  );
});
