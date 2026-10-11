import { useState, useCallback } from 'react';
import { Sun, Moon, TrendingUp, ArrowUpRight, ArrowDownRight, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ParticleBackground } from '@/components/ParticleBackground';
import { SemiGauge } from '@/components/SemiGauge';
import { TabBar } from '@/components/TabBar';
import { TransactionList } from '@/components/TransactionList';
import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { balanceData, formatCurrency } from '@/data/mockData';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleSaveTransaction = useCallback(
    (data: { amount: number; category: string; isIncome: boolean }) => {
      console.log('Transaction saved:', data);
    },
    []
  );

  return (
    <div className="relative min-h-screen bg-white dark:bg-amoled transition-colors duration-300">
      {/* Scrollable container */}
      <div className="relative mx-auto min-h-screen max-w-md overflow-y-auto no-scrollbar pb-32">
        {/* === TOP HEADER (Digital Dome) === */}
        <header className="relative overflow-hidden px-5 pt-12 pb-8">
          <ParticleBackground isDark={theme === 'dark'} />

          {/* Theme switcher + balance visibility */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm">
                <span className="text-sm font-bold gradient-text">F</span>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Добро пожаловать</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Иван Петров</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm transition-transform active:scale-90 gpu"
                aria-label="Скрыть баланс"
              >
                {balanceVisible ? (
                  <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                ) : (
                  <EyeOff className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                )}
              </button>
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm transition-transform active:scale-90 gpu"
                aria-label="Переключить тему"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigoblue" />
                )}
              </button>
            </div>
          </div>

          {/* Balance display */}
          <div className="relative z-10 mt-8 animate-fade-in-up">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Общий баланс
            </p>
            <div className="mt-1.5 flex items-end gap-2">
              <h1 className="font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums">
                {balanceVisible ? formatCurrency(balanceData.totalBalance) : '•• ••••'}
                <span className="ml-1.5 text-2xl text-neutral-400 dark:text-neutral-500">₽</span>
              </h1>
            </div>

            {/* Monthly growth pill */}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint/10 dark:bg-mint/10 px-3 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-mint dark:text-mint" />
              <span className="text-xs font-medium text-mint dark:text-mint">
                +{formatCurrency(balanceData.monthlyGrowth)} ₽ за месяц
              </span>
            </div>
          </div>

          {/* Income / Expense cards */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="rounded-2xl neu-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/10 dark:bg-mint/10">
                  <ArrowUpRight className="h-4 w-4 text-mint dark:text-mint" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Доход
                </span>
              </div>
              <p className="mt-2.5 font-light tracking-tight text-2xl text-neutral-900 dark:text-white tabular-nums">
                {formatCurrency(balanceData.income)}
                <span className="ml-1 text-sm text-neutral-400 dark:text-neutral-500">₽</span>
              </p>
            </div>

            <div className="rounded-2xl neu-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800/50">
                  <ArrowDownRight className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Расход
                </span>
              </div>
              <p className="mt-2.5 font-light tracking-tight text-2xl text-neutral-900 dark:text-white tabular-nums">
                {formatCurrency(balanceData.expenses)}
                <span className="ml-1 text-sm text-neutral-400 dark:text-neutral-500">₽</span>
              </p>
            </div>
          </div>
        </header>

        {/* === MIDDLE SECTION (Semicircular Gauge) === */}
        <section className="px-5 mt-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="rounded-3xl neu-card p-6 pb-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Бюджет месяца
              </h2>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/50 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                Октябрь 2026
              </span>
            </div>

            <div className="flex justify-center">
              <SemiGauge
                spent={balanceData.expenses}
                budget={balanceData.monthlyBudget}
                safeToSpend={balanceData.safeToSpend}
              />
            </div>

            {/* Progress bar */}
            <div className="mt-2 px-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-mint to-indigoblue transition-all duration-1000 ease-out"
                  style={{
                    width: `${(balanceData.expenses / balanceData.monthlyBudget) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
                <span>{formatCurrency(balanceData.expenses)} ₽ потрачено</span>
                <span>{formatCurrency(balanceData.monthlyBudget - balanceData.expenses)} ₽ осталось</span>
              </div>
            </div>
          </div>
        </section>

        {/* === BOTTOM SECTION (Transactions + Tab Bar) === */}
        <section className="px-5">
          <TransactionList />
        </section>
      </div>

      {/* Floating Island Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setIsSheetOpen(true)} />

      {/* Add Transaction Bottom Sheet */}
      <AddTransactionSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
}

export default App;
