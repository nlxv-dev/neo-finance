
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  Contrast,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Minus,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { ParticleBackground } from '@/components/ParticleBackground';
import { SemiGauge } from '@/components/SemiGauge';
import { TabBar } from '@/components/TabBar';
import { TransactionList } from '@/components/TransactionList';
import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { ProfileSheet } from '@/components/ProfileSheet';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { BalanceAdjustSheet } from '@/components/BalanceAdjustSheet';
import { BudgetEditSheet } from '@/components/BudgetEditSheet';
import { formatCurrency, getBudgetStatus, type Transaction } from '@/data/mockData';
import { resolveTransactionDateISO } from '@/data/transactionDates';
import { StatisticsScreen } from '@/components/StatisticsScreen';

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function App() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isThemeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsThemeMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeMenuOpen]);
  const [activeTab, setActiveTab] = useState('home');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBalanceAdjustOpen, setIsBalanceAdjustOpen] = useState(false);
  const [isBudgetEditOpen, setIsBudgetEditOpen] = useState(false);

  const {
    userName,
    initialBalance,
    updateName,
    updateInitialBalance,
    monthlyBudget,
    updateMonthlyBudget,
  } = useProfile();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const {
    transactions,
    addTransaction,
    resetTransactions,
    updateTransaction,
    deleteTransaction,
    totalIncome,
    totalExpenses,
    totalBalance,
  } = useTransactions(initialBalance, categories);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const currentMonthTransactions = useMemo(
    () => transactions.filter((transaction) => resolveTransactionDateISO(transaction)?.startsWith(currentMonthKey)),
    [transactions, currentMonthKey]
  );
  const monthlyIncome = currentMonthTransactions.reduce(
    (sum, transaction) => sum + (transaction.isIncome ? transaction.amount : 0),
    0
  );
  const monthlyExpenses = currentMonthTransactions.reduce(
    (sum, transaction) => sum + (!transaction.isIncome ? transaction.amount : 0),
    0
  );
  const monthlyGrowth = monthlyIncome - monthlyExpenses;
  const safeToSpend = monthlyBudget - monthlyExpenses;
  const budgetPercent = monthlyBudget > 0 ? (monthlyExpenses / monthlyBudget) * 100 : 0;
  const budgetStatus = getBudgetStatus(monthlyExpenses, monthlyBudget);
  const isOverbudget = monthlyExpenses > monthlyBudget;

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
    (data: { amount: number; categoryId: string; isIncome: boolean }) => {
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
    (id: number, updates: { amount: number; categoryId: string; isIncome: boolean }) => {
      updateTransaction(id, updates);
      const selectedCategory = categories.find((category) => category.id === updates.categoryId);
      setSelectedTransaction((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              ...updates,
              ...(selectedCategory
                ? {
                    title: selectedCategory.name,
                    category: selectedCategory.name,
                    categoryIconName: selectedCategory.iconName,
                  }
                : {}),
            }
          : prev
      );
    },
    [updateTransaction, categories]
  );

  const handleDeleteCategory = useCallback(
    (categoryId: string) => {
      const isUsedByHistory = transactions.some((transaction) => transaction.categoryId === categoryId);
      deleteCategory(categoryId, isUsedByHistory);
    },
    [deleteCategory, transactions]
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

        {activeTab === 'stats' ? (
          <StatisticsScreen
            transactions={transactions}
            categories={categories}
            onSelectTransaction={setSelectedTransaction}
          />
        ) : (
          <>
        {/* === TOP HEADER (Digital Dome) === */}
        <header className="relative overflow-hidden px-5 pt-12 pb-5">
          <ParticleBackground isDark={theme === 'dark'} />

          {/* Theme switcher */}
          <div className="relative z-30 flex items-center justify-between">
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

            <div ref={themeMenuRef} className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-xl neu-card-sm transition-transform active:scale-90 gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60"
                aria-label={`Тема оформления: ${themeMode === 'system' ? 'системная' : themeMode === 'light' ? 'светлая' : 'тёмная'}`}
                aria-haspopup="menu"
                aria-expanded={isThemeMenuOpen}
              >
                {themeMode === 'system' ? (
                  <Contrast className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
                ) : themeMode === 'light' ? (
                  <Sun className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
                ) : (
                  <Moon className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
                )}
              </button>

              {isThemeMenuOpen && (
                <div
                  role="menu"
                  aria-label="Тема оформления"
                  className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-neutral-200/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-900/95 dark:shadow-[0_16px_40px_rgba(0,0,0,0.48)] animate-fade-in"
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === 'system'}
                    onClick={() => { setThemeMode('system'); setIsThemeMenuOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${themeMode === 'system' ? 'bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white' : 'text-neutral-600 hover:bg-neutral-100/70 dark:text-neutral-300 dark:hover:bg-white/5'}`}
                  >
                    <Contrast className="h-5 w-5 shrink-0" />
                    <span>Системная</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === 'light'}
                    onClick={() => { setThemeMode('light'); setIsThemeMenuOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${themeMode === 'light' ? 'bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white' : 'text-neutral-600 hover:bg-neutral-100/70 dark:text-neutral-300 dark:hover:bg-white/5'}`}
                  >
                    <Sun className="h-5 w-5 shrink-0" />
                    <span>Светлая</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === 'dark'}
                    onClick={() => { setThemeMode('dark'); setIsThemeMenuOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${themeMode === 'dark' ? 'bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white' : 'text-neutral-600 hover:bg-neutral-100/70 dark:text-neutral-300 dark:hover:bg-white/5'}`}
                  >
                    <Moon className="h-5 w-5 shrink-0" />
                    <span>Тёмная</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Balance display — clickable to adjust */}
          <div className="relative z-10 mt-8 animate-fade-in-up">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Общий баланс
            </p>

            <h1 className="mt-1.5 font-light tracking-tight text-5xl text-neutral-900 dark:text-white">
              <button
                type="button"
                onClick={() => setIsBalanceAdjustOpen(true)}
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

            {/* Monthly growth pill */}
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

        {/* === MIDDLE SECTION (Semicircular Gauge) === */}
        <section
          className="mt-2 px-5 animate-fade-in"
          style={{ animationDelay: '200ms' }}
        >
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
                spent={monthlyExpenses}
                budget={monthlyBudget}
                safeToSpend={safeToSpend}
                onEditBudget={() => setIsBudgetEditOpen(true)}
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
                <span>{formatCurrency(monthlyExpenses)} ₽ потрачено</span>

                <span
                  className={
                    isOverbudget
                      ? 'text-red-500 dark:text-red-400 font-medium'
                      : ''
                  }
                >
                  {isOverbudget
                    ? `-${formatCurrency(monthlyExpenses - monthlyBudget)} ₽ перерасход`
                    : `${formatCurrency(Math.max(0, monthlyBudget - monthlyExpenses))} ₽ осталось`}
                </span>
              </div>

            </div>
          </div>
        </section>

        {/* === BOTTOM SECTION (Transactions + Tab Bar) === */}
        <section className="px-5">
          <TransactionList
            transactions={transactions}
            categories={categories}
            onSelect={setSelectedTransaction}
          />
        </section>
          </>
        )}
      </div>

      {/* Floating Island Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddClick={() => setIsSheetOpen(true)}
      />

      {/* Add Transaction Bottom Sheet */}
      <AddTransactionSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveTransaction}
      />

      {/* Transaction Detail / Edit / Delete Bottom Sheet */}
      <TransactionDetailSheet
        transaction={selectedTransaction}
        categories={categories}
        onClose={() => setSelectedTransaction(null)}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* Balance Adjust Sheet */}
      <BalanceAdjustSheet
        open={isBalanceAdjustOpen}
        onClose={() => setIsBalanceAdjustOpen(false)}
        currentBalance={totalBalance}
        onAdjust={handleBalanceAdjust}
      />

      {/* Monthly Budget Edit Sheet */}
      <BudgetEditSheet
        open={isBudgetEditOpen}
        onClose={() => setIsBudgetEditOpen(false)}
        currentBudget={monthlyBudget}
        onSave={updateMonthlyBudget}
      />

      {/* Profile & Settings Sheet */}
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
