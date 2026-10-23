import { ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { BudgetIndicator } from '@/components/ui/BudgetIndicator';
import { TransactionList } from '@/components/TransactionList';
import { formatCurrency, type Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';

interface HomeScreenProps {
  userName: string;
  totalBalance: number;
  monthlyGrowth: number;
  monthLabel: string;
  monthlyExpenses: number;
  monthlyBudget: number;
  safeToSpend: number;
  transactions: Transaction[];
  categories: CustomCategory[];
  onOpenSettings: () => void;
  onOpenBalance: () => void;
  onOpenBudget: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
}

export function HomeScreen({
  userName,
  totalBalance,
  monthlyGrowth,
  monthLabel,
  monthlyExpenses,
  monthlyBudget,
  safeToSpend,
  transactions,
  categories,
  onOpenSettings,
  onOpenBalance,
  onOpenBudget,
  onSelectTransaction,
}: HomeScreenProps) {
  return (
    <>
      <header className="relative px-5 pb-5 pt-[calc(env(safe-area-inset-top)_+_3rem)]">
        <div className="relative z-30 flex items-center">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 transition-transform active:scale-95 gpu"
            aria-label="Открыть настройки"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm">
              <span className="text-sm font-bold gradient-text">N</span>
            </div>

            <div className="text-left">
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Добро пожаловать
              </p>
              <div className="flex items-center gap-0.5">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {userName}
                </p>
                <ChevronRight className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
              </div>
            </div>
          </button>
        </div>

        <div className="relative z-10 mt-8 animate-fade-in-up">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Общий баланс
          </p>

          <h1 className="mt-1.5 font-light tracking-tight text-5xl text-neutral-900 dark:text-white">
            <button
              type="button"
              onClick={onOpenBalance}
              className="inline-flex items-end rounded-lg transition-opacity hover:opacity-80 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
              aria-label={`Изменить общий баланс: ${formatCurrency(totalBalance)} рублей`}
            >
              <span className="inline-flex items-end">
                <AnimatedCounter value={totalBalance} />
                <span className="ml-1.5 pb-1 text-2xl text-neutral-400 dark:text-neutral-500">
                  ₽
                </span>
              </span>
            </button>
          </h1>

          <div
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              monthlyGrowth > 0
                ? 'bg-mint/10 dark:bg-mint/10'
                : monthlyGrowth < 0
                  ? 'bg-red-500/10 dark:bg-red-500/10'
                  : 'bg-neutral-100 dark:bg-neutral-800/50'
            }`}
          >
            {monthlyGrowth > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-mint dark:text-mint" />
            ) : monthlyGrowth < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
            )}

            <span
              className={`text-xs font-medium ${
                monthlyGrowth > 0
                  ? 'text-mint dark:text-mint'
                  : monthlyGrowth < 0
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {monthlyGrowth > 0 ? '+' : ''}
              {formatCurrency(monthlyGrowth)} ₽ за месяц
            </span>
          </div>
        </div>
      </header>

      <section className="mt-2 px-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="rounded-3xl neu-card p-6 pb-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Бюджет месяца
            </h2>

            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800/50 dark:text-neutral-400">
              {monthLabel}
            </span>
          </div>

          <BudgetIndicator
            spent={monthlyExpenses}
            budget={monthlyBudget}
            safeToSpend={safeToSpend}
            onEditBudget={onOpenBudget}
          />
        </div>
      </section>

      <section className="px-5">
        <TransactionList
          transactions={transactions}
          categories={categories}
          onSelect={onSelectTransaction}
        />
      </section>
    </>
  );
}
