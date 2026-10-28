import { ChevronRight } from 'lucide-react';
import { BudgetIndicator } from '@/components/ui/BudgetIndicator';
import { TransactionList } from '@/components/TransactionList';
import { BalanceCardCarousel } from '@/components/BalanceCardCarousel';
import type { Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/data/categories';
import type { Account } from '@/data/accounts';

interface HomeScreenProps {
  userName: string;
  monthLabel: string;
  currentMonthKey: string;
  monthlyExpenses: number;
  monthlyBudget: number;
  safeToSpend: number;
  transactions: Transaction[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  canWriteAccounts: boolean;
  categories: CustomCategory[];
  onOpenSettings: () => void;
  onOpenBalance: (accountId: string) => void;
  onAddAccount: () => void;
  onOpenBudget: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
}

export function HomeScreen({
  userName,
  monthLabel,
  currentMonthKey,
  monthlyExpenses,
  monthlyBudget,
  safeToSpend,
  transactions,
  accounts,
  accountBalances,
  canWriteAccounts,
  categories,
  onOpenSettings,
  onOpenBalance,
  onAddAccount,
  onOpenBudget,
  onSelectTransaction,
}: HomeScreenProps) {
  return (
    <>
      <header className="relative px-5 pb-3 pt-[calc(env(safe-area-inset-top)_+_3rem)]">
        <div className="relative z-30 flex items-center">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 transition-transform active:scale-95 "
            aria-label="Открыть настройки"
          >
            <div className="h-9 w-9 overflow-hidden rounded-xl neu-card-sm">
              <img
                src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
                alt=""
                className="h-full w-full object-cover"
              />
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

        <div className="relative z-10 mt-7 animate-fade-in-up">
          <BalanceCardCarousel
            accounts={accounts}
            accountBalances={accountBalances}
            transactions={transactions}
            currentMonthKey={currentMonthKey}
            canWriteAccounts={canWriteAccounts}
            onEditBalance={onOpenBalance}
            onAddAccount={onAddAccount}
          />
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
          accounts={accounts}
          categories={categories}
          onSelect={onSelectTransaction}
        />
      </section>
    </>
  );
}
