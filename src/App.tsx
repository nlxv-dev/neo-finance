import { useState, useCallback, useMemo } from 'react';
import { Sun, Moon, TrendingUp, ArrowUpRight, ArrowDownRight, Eye, EyeOff, ChevronRight, Pencil } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTransactions } from '@/hooks/useTransactions';
import { useProfile } from '@/hooks/useProfile';
import { ParticleBackground } from '@/components/ParticleBackground';
import { SemiGauge } from '@/components/SemiGauge';
import { TabBar } from '@/components/TabBar';
import { TransactionList } from '@/components/TransactionList';
import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { ProfileSheet } from '@/components/ProfileSheet';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { BalanceAdjustSheet } from '@/components/BalanceAdjustSheet';
import { formatCurrency, MONTHLY_BUDGET, getBudgetStatus, type Transaction } from '@/data/mockData';

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBalanceAdjustOpen, setIsBalanceAdjustOpen] = useState(false);

  const { userName, initialBalance, updateName, updateInitialBalance } = useProfile();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { transactions, addTransaction, resetTransactions, updateTransaction, deleteTransaction, totalIncome, totalExpenses, totalBalance } = useTransactions(initialBalance);

  const monthlyGrowth = totalIncome - totalExpenses;
  const safeToSpend = MONTHLY_BUDGET - totalExpenses;
  const budgetPercent = (totalExpenses / MONTHLY_BUDGET) * 100;
  const budgetStatus = getBudgetStatus(totalExpenses, MONTHLY_BUDGET);
  const isOverbudget = totalExpenses > MONTHLY_BUDGET;
  const progressGradient =
    budgetStatus === 'normal'
      ? 'from-mint to-indigoblue'
      : budgetStatus === 'warning'
      ? 'from-amber-500 to-orange-400'
      : 'from-red-500 to-red-500';
  const progressWidth = Math.min(100, budgetPercent);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return `${MONTHS_RU[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const handleSaveTransaction = useCallback(
    (data: { amount: number; category: string; isIncome: boolean }) => {
      addTransaction(data);
    },
    [addTransaction]
  );

  const handleResetData = useCallback(() => {
    resetTransactions();
  }, [resetTransactions]);

  const handleBalanceAdjust = useCallback(
    (targetBalance: number) => {
      const newInitialBalance = targetBalance - totalIncome + totalExpenses;
      updateInitialBalance(newInitialBalance);
    },
    [updateInitialBalance, totalIncome, totalExpenses]
  );

  const handleUpdateTransaction = useCallback(
    (id: number, updates: { amount: number; category: string; isIncome: boolean }) => {
      updateTransaction(id, updates);
      setSelectedTransaction((prev) =>
        prev && prev.id === id ? { ...prev, ...updates, title: updates.category } : prev
      );
    },
    [updateTransaction]
  );

  const handleDeleteTransaction = useCallback(
    (id: number) => {
      deleteTransaction(id);
    },
    [deleteTransaction]
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
            {/* Clickable profile block */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 transition-transform active:scale-95 gpu"
              aria-label="Открыть профиль"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm">
                <span className="text-sm font-bold gradient-text">F</span>
              </div>
              <div className="text-left">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Добро пожаловать</p>
                <div className="flex items-center gap-0.5">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{userName}</p>
                  <ChevronRight className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                </div>
              </div>
            </button>

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

          {/* Balance display — clickable to adjust */}
          <div className="relative z-10 mt-8 animate-fade-in-up">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Общий баланс
            </p>
            <button
              onClick={() => setIsBalanceAdjustOpen(true)}
              className="group mt-1.5 flex items-end gap-2 transition-transform active:scale-95 gpu"
              aria-label="Корректировка баланса"
            >
              <h1 className="font-light tracking-tight text-5xl text-neutral-900 dark:text-white tabular-nums">
                {balanceVisible ? formatCurrency(totalBalance) : '•• ••••'}
                <span className="ml-1.5 text-2xl text-neutral-400 dark:text-neutral-500">₽</span>
              </h1>
              {balanceVisible && (
                <Pencil className="mb-2 h-4 w-4 text-neutral-300 transition-colors group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-400" />
              )}
            </button>

            {/* Monthly growth pill */}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint/10 dark:bg-mint/10 px-3 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-mint dark:text-mint" />
              <span className="text-xs font-medium text-mint dark:text-mint">
                {monthlyGrowth >= 0 ? '+' : ''}{formatCurrency(monthlyGrowth)} ₽ за месяц
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
                {formatCurrency(totalIncome)}
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
                {formatCurrency(totalExpenses)}
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
                {monthLabel}
              </span>
            </div>

            <div className="flex justify-center">
              <SemiGauge
                spent={totalExpenses}
                budget={MONTHLY_BUDGET}
                safeToSpend={safeToSpend}
              />
            </div>

            {/* Progress bar */}
            <div className="mt-2 px-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/50">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${progressGradient} transition-all duration-1000 ease-out`}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
                <span>{formatCurrency(totalExpenses)} ₽ потрачено</span>
                <span className={isOverbudget ? 'text-red-500 dark:text-red-400 font-medium' : ''}>
                  {isOverbudget
                    ? `-${formatCurrency(totalExpenses - MONTHLY_BUDGET)} ₽ перерасход`
                    : `${formatCurrency(Math.max(0, MONTHLY_BUDGET - totalExpenses))} ₽ осталось`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* === BOTTOM SECTION (Transactions + Tab Bar) === */}
        <section className="px-5">
          <TransactionList transactions={transactions} onSelect={setSelectedTransaction} />
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

      {/* Transaction Detail / Edit / Delete Bottom Sheet */}
      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* Balance Adjust Bottom Sheet */}
      <BalanceAdjustSheet
        open={isBalanceAdjustOpen}
        onClose={() => setIsBalanceAdjustOpen(false)}
        currentBalance={totalBalance}
        onAdjust={handleBalanceAdjust}
      />

      {/* Profile & Settings Bottom Sheet */}
      <ProfileSheet
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userName={userName}
        initialBalance={initialBalance}
        onUpdateName={updateName}
        onUpdateInitialBalance={updateInitialBalance}
        onResetData={handleResetData}
      />
    </div>
  );
}

export default App;
