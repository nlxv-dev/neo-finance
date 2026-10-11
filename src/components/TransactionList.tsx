import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Check } from 'lucide-react';
import { transactions, formatCurrency, type Transaction } from '@/data/mockData';

export function TransactionList() {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const filtered = transactions.filter((t) => {
    if (filter === 'income') return t.isIncome;
    if (filter === 'expense') return !t.isIncome;
    return true;
  });

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Последние транзакции
        </h2>
        <div className="flex gap-1.5">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 gpu ${
                filter === f
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                  : 'text-neutral-400 dark:text-neutral-500'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'income' ? 'Доход' : 'Расход'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((tx, i) => (
          <TransactionRow key={tx.id} tx={tx} index={i} />
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ tx, index }: { tx: Transaction; index: number }) {
  const Icon = tx.icon;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl neu-card-sm p-3 animate-slide-up gpu"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tx.isIncome
            ? 'bg-mint/10 dark:bg-mint/10'
            : 'bg-neutral-100 dark:bg-neutral-800/50'
        }`}
      >
        <Icon
          className={`h-5 w-5 ${
            tx.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-500 dark:text-neutral-400'
          }`}
          strokeWidth={2}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
          {tx.title}
        </p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          {tx.category} · {tx.date}
        </p>
      </div>

      <div className="flex flex-col items-end">
        <span
          className={`flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
            tx.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-900 dark:text-white'
          }`}
        >
          {tx.isIncome ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
          )}
          {formatCurrency(tx.amount)} ₽
        </span>
      </div>
    </div>
  );
}
