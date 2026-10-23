import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Wallet } from 'lucide-react';
import AddTransactionSheet from '@/components/AddTransactionSheet';
import { BalanceAdjustSheet } from '@/components/BalanceAdjustSheet';
import { BudgetEditSheet } from '@/components/BudgetEditSheet';
import { HomeScreen } from '@/components/HomeScreen';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import { StorageRecoveryNotice } from '@/components/StorageRecoveryNotice';
import { TabBar, type AppTab } from '@/components/TabBar';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import type { Transaction } from '@/data/mockData';
import { useBudgetSummary } from '@/hooks/useBudgetSummary';
import { useCategories } from '@/hooks/useCategories';
import { useCurrentMonth } from '@/hooks/useCurrentMonth';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { useTransactions } from '@/hooks/useTransactions';
import { downloadRecoverySnapshot, requestPersistentStorage } from '@/storage/safeLocalStorage';

type ActiveSheet = 'add' | 'detail' | 'profile' | 'budget' | 'balance' | null;

function App() {
  const { themeMode, setThemeMode } = useTheme();

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<Transaction['id'] | null>(null);

  const {
    userName,
    initialBalance,
    updateName,
    updateInitialBalance,
    monthlyBudget,
    updateMonthlyBudget,
    storageIssues: profileStorageIssues,
  } = useProfile();
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    storageIssues: categoryStorageIssues,
  } = useCategories();

  const hasUnreadableProfileData = profileStorageIssues.some((issue) => issue.kind !== 'write-failed');
  const hasUnreadableCategories = categoryStorageIssues.some((issue) => issue.kind !== 'write-failed');
  const canPersistTransactions = !hasUnreadableProfileData && !hasUnreadableCategories;

  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    totalIncome,
    totalExpenses,
    totalBalance,
    storageIssues: transactionStorageIssues,
  } = useTransactions(initialBalance, categories, canPersistTransactions);

  const storageIssues = useMemo(
    () => [...profileStorageIssues, ...categoryStorageIssues, ...transactionStorageIssues],
    [profileStorageIssues, categoryStorageIssues, transactionStorageIssues]
  );
  const { currentMonthKey, monthLabel } = useCurrentMonth();
  const budget = useBudgetSummary(transactions, monthlyBudget, currentMonthKey);

  const selectedTransaction = useMemo(
    () => selectedTransactionId === null
      ? null
      : transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null,
    [transactions, selectedTransactionId]
  );

  const closeSheet = useCallback(() => setActiveSheet(null), []);

  const handleDownloadRecovery = useCallback(() => {
    downloadRecoverySnapshot(
      {
        transactions,
        categories,
        profile: { userName, initialBalance, monthlyBudget },
      },
      storageIssues
    );
  }, [transactions, categories, userName, initialBalance, monthlyBudget, storageIssues]);

  const handleSaveTransaction = useCallback(
    (data: { amount: number; categoryId: string; isIncome: boolean }) => {
      addTransaction(data);
      closeSheet();
    },
    [addTransaction, closeSheet]
  );

  const handleBalanceAdjust = useCallback(
    (targetBalance: number) => {
      updateInitialBalance(targetBalance - totalIncome + totalExpenses);
    },
    [updateInitialBalance, totalIncome, totalExpenses]
  );

  const handleUpdateTransaction = useCallback(
    (id: number, updates: { amount: number; categoryId: string; isIncome: boolean }) => {
      updateTransaction(id, updates);
    },
    [updateTransaction]
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

  const handleSelectTransaction = useCallback((transaction: Transaction) => {
    setSelectedTransactionId(transaction.id);
    setActiveSheet('detail');
  }, []);

  const handleDetailExited = useCallback(() => {
    setSelectedTransactionId(null);
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent text-neutral-900 transition-colors duration-300 dark:text-white">
      {isSettingsOpen ? (
        <SettingsScreen
          onClose={() => setIsSettingsOpen(false)}
          userName={userName}
          initialBalance={initialBalance}
          monthlyBudget={monthlyBudget}
          updateName={updateName}
          updateInitialBalance={updateInitialBalance}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          transactions={transactions}
          categories={categories}
          addCategory={addCategory}
          updateCategory={updateCategory}
          deleteCategory={handleDeleteCategory}
          onDownloadRecovery={handleDownloadRecovery}
          storageWriteFailed={storageIssues.some((issue) => issue.kind === 'write-failed')}
        />
      ) : (
        <>
          <div className="relative mx-auto min-h-screen max-w-md overflow-y-auto no-scrollbar pb-32">
            {activeTab === 'stats' ? (
              <StatisticsScreen
                transactions={transactions}
                categories={categories}
                onSelectTransaction={handleSelectTransaction}
              />
            ) : activeTab === 'wallet' ? (
              <PlaceholderScreen
                icon={Wallet}
                section="Кошелёк"
                description="Здесь появится управление счетами, картами и наличными."
              />
            ) : activeTab === 'chart' ? (
              <PlaceholderScreen
                icon={BarChart3}
                section="Отчёты"
                description="Здесь появятся подробные отчёты, графики и экспорт за выбранный период."
              />
            ) : (
              <HomeScreen
                userName={userName}
                totalBalance={totalBalance}
                monthlyGrowth={budget.monthlyGrowth}
                monthLabel={monthLabel}
                monthlyExpenses={budget.monthlyExpenses}
                monthlyBudget={monthlyBudget}
                safeToSpend={budget.safeToSpend}
                transactions={transactions}
                categories={categories}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenBalance={() => setActiveSheet('balance')}
                onOpenBudget={() => setActiveSheet('budget')}
                onSelectTransaction={handleSelectTransaction}
              />
            )}
          </div>

          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAddClick={() => setActiveSheet('add')}
          />
        </>
      )}

      <AddTransactionSheet
        open={activeSheet === 'add'}
        onClose={closeSheet}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveTransaction}
      />

      <TransactionDetailSheet
        open={activeSheet === 'detail'}
        transaction={selectedTransaction}
        categories={categories}
        onClose={closeSheet}
        onExited={handleDetailExited}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />

      <BalanceAdjustSheet
        open={activeSheet === 'balance'}
        onClose={closeSheet}
        currentBalance={totalBalance}
        onAdjust={handleBalanceAdjust}
      />

      <BudgetEditSheet
        open={activeSheet === 'budget'}
        onClose={closeSheet}
        currentBudget={monthlyBudget}
        onSave={updateMonthlyBudget}
      />

      <StorageRecoveryNotice issues={storageIssues} onDownloadRecovery={handleDownloadRecovery} />
    </div>
  );
}

export default App;
