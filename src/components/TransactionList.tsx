import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { IconRenderer } from '@/components/IconRenderer';
import { formatCurrency, type Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';

interface TransactionListProps {
  transactions: Transaction[];
  categories: CustomCategory[];
  onSelect?: (tx: Transaction) => void;
}

export function TransactionList({ transactions, categories, onSelect }: TransactionListProps) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const filtered = transactions.filter((transaction) => {
    if (filter === 'income') return transaction.isIncome;
    if (filter === 'expense') return !transaction.isIncome;
    return true;
  });

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
              onClick={() => setFilter(filterType)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 gpu ${
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
          filtered.map((transaction, index) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categories={categories}
              index={index}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
  categories,
  index,
  onSelect,
}: {
  transaction: Transaction;
  categories: CustomCategory[];
  index: number;
  onSelect?: (tx: Transaction) => void;
}) {
  // Category IDs, not names, are the source of truth. The snapshot is a fallback
  // for older ambiguous records that cannot be mapped without guessing.
  const currentCategory = categories.find((category) => category.id === transaction.categoryId);
  const categoryName = currentCategory?.name ?? transaction.category;
  const categoryIcon = currentCategory?.iconName ?? transaction.categoryIconName ?? 'HelpCircle';

  return (
    <button
      onClick={() => onSelect?.(transaction)}
      className="flex w-full items-center gap-3 rounded-2xl neu-card-sm p-3 animate-slide-up gpu transition-transform active:scale-[0.98] text-left"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-label={`Транзакция: ${categoryName}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          transaction.isIncome
            ? 'bg-mint/10 dark:bg-mint/10'
            : 'bg-neutral-100 dark:bg-neutral-800/50'
        }`}
      >
        <IconRenderer
          name={categoryIcon}
          className={`h-5 w-5 ${
            transaction.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
          {categoryName}
        </p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          {transaction.date}
        </p>
      </div>

      <div className="flex flex-col items-end">
        <span
          className={`flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
            transaction.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-900 dark:text-white'
          }`}
        >
          {transaction.isIncome ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
          )}
          {formatCurrency(transaction.amount)} ₽
        </span>
      </div>
    </button>
  );
}
