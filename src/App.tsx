import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddTransactionSheet from '@/components/AddTransactionSheet';
import { BalanceAdjustSheet } from '@/components/BalanceAdjustSheet';
import { AccountEditSheet } from '@/components/AccountEditSheet';
import { BudgetEditSheet } from '@/components/BudgetEditSheet';
import { HomeScreen } from '@/components/HomeScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import { WalletScreen } from '@/components/WalletScreen';
import { GoalsScreen } from '@/components/GoalsScreen';
import { TransferSheet, type TransferDraft } from '@/components/TransferSheet';
import { StorageRecoveryNotice } from '@/components/StorageRecoveryNotice';
import { TabBar, type AppTab } from '@/components/TabBar';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { Transaction } from '@/data/mockData';
import { useAccounts, type AccountInput } from '@/hooks/useAccounts';
import { useBudgetSummary } from '@/hooks/useBudgetSummary';
import { useCategories } from '@/hooks/useCategories';
import { useCurrentMonth } from '@/hooks/useCurrentMonth';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { useTransactions } from '@/hooks/useTransactions';
import { useGoals } from '@/hooks/useGoals';
import { calculateAccountOpeningBalanceForTargetBalance, calculateAllAccountBalances, calculateBalancesByCurrency, sumAccountBalancesByCurrency } from '@/utils/financialMath';
import { filterTransactionsForCurrency, getOtherCurrencyCodes } from '@/utils/accountAnalytics';
import { downloadRecoverySnapshot, requestPersistentStorage } from '@/storage/safeLocalStorage';

type ActiveSheet = 'add' | 'detail' | 'transfer' | 'profile' | 'budget' | 'balance' | 'account-add' | null;

// Keep visited screens mounted without letting unrelated App state updates
// force every screen and its transaction list to re-render.
const MemoizedHomeScreen = memo(HomeScreen);
const MemoizedStatisticsScreen = memo(StatisticsScreen);
const MemoizedWalletScreen = memo(WalletScreen);
const MemoizedGoalsScreen = memo(GoalsScreen);

function App() {
  const { themeMode, setThemeMode, backgroundStyle, setBackgroundStyle } = useTheme();

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [visitedTabs, setVisitedTabs] = useState<Set<AppTab>>(() => new Set(['home']));
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsOpenerRef = useRef<HTMLElement | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<Transaction['id'] | null>(null);
  const [balanceEditorAccountId, setBalanceEditorAccountId] = useState<string>(MAIN_ACCOUNT_ID);

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
    addTransfer,
    updateTransaction,
    deleteTransaction,
    reconcileAccountReferences,
    storageIssues: transactionStorageIssues,
  } = useTransactions(categories, canPersistTransactions);

  const hasUnreadableTransactions = transactionStorageIssues.some((issue) => issue.kind !== 'write-failed');
  const {
    accounts,
    addAccount,
    updateAccount,
    setAccountArchived,
    storageIssues: accountStorageIssues,
    canWrite: canWriteAccounts,
  } = useAccounts(initialBalance, canPersistTransactions && !hasUnreadableTransactions);

  const {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    addProgress: addGoalProgress,
    reduceProgress: reduceGoalProgress,
    totalSaved: goalsTotalSaved,
    totalTarget: goalsTotalTarget,
    overallProgress: goalsOverallProgress,
    activeCount: activeGoalsCount,
    completedCount: completedGoalsCount,
    storageIssues: goalStorageIssues,
    canWrite: canWriteGoals,
  } = useGoals();

  useEffect(() => {
    if (!canWriteAccounts) return;
    reconcileAccountReferences(accounts.map((account) => account.id));
  }, [accounts, canWriteAccounts, reconcileAccountReferences]);

  const rubTransactions = useMemo(
    () => filterTransactionsForCurrency(transactions, accounts, 'RUB'),
    [transactions, accounts],
  );
  const otherCurrencyCodes = useMemo(() => getOtherCurrencyCodes(accounts, 'RUB'), [accounts]);
  const transactionAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived && account.currency.toUpperCase() === 'RUB'),
    [accounts],
  );

  const mainAccount = useMemo(
    () => accounts.find((account) => account.id === MAIN_ACCOUNT_ID) ?? null,
    [accounts]
  );
  const mainAccountInitialBalance = mainAccount?.initialBalance ?? initialBalance;
  // Every home card reads its live balance from the same canonical account calculation.
  const accountBalances = useMemo(
    () => calculateAllAccountBalances(accounts, transactions),
    [accounts, transactions]
  );
  const balancesByCurrency = useMemo(
    () => accounts.length > 0
      ? sumAccountBalancesByCurrency(accounts, accountBalances)
      : calculateBalancesByCurrency(accounts, transactions, mainAccountInitialBalance),
    [accounts, accountBalances, transactions, mainAccountInitialBalance],
  );
  const balanceEditorAccount = accounts.find((account) => account.id === balanceEditorAccountId) ?? mainAccount;
  const balanceEditorCurrentBalance = balanceEditorAccount
    ? (accountBalances[balanceEditorAccount.id] ?? balanceEditorAccount.initialBalance)
    : mainAccountInitialBalance;

  const storageIssues = useMemo(
    () => [...profileStorageIssues, ...categoryStorageIssues, ...transactionStorageIssues, ...accountStorageIssues, ...goalStorageIssues],
    [profileStorageIssues, categoryStorageIssues, transactionStorageIssues, accountStorageIssues, goalStorageIssues]
  );
  const { currentMonthKey, monthLabel } = useCurrentMonth();
  const budget = useBudgetSummary(rubTransactions, monthlyBudget, currentMonthKey);

  const selectedTransaction = useMemo(
    () => selectedTransactionId === null
      ? null
      : transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null,
    [transactions, selectedTransactionId]
  );

  const closeSheet = useCallback(() => setActiveSheet(null), []);
  const openAddAccountSheet = useCallback(() => setActiveSheet('account-add'), []);
  const openBudgetSheet = useCallback(() => setActiveSheet('budget'), []);
  const openTransferSheet = useCallback(() => setActiveSheet('transfer'), []);
  const openAddTransactionSheet = useCallback(() => setActiveSheet('add'), []);

  const handleAddAccount = useCallback((input: AccountInput) => {
    addAccount(input);
  }, [addAccount]);

  const handleOpenBalanceAdjust = useCallback((accountId: string) => {
    setBalanceEditorAccountId(accountId);
    setActiveSheet('balance');
  }, []);

  const handleDownloadRecovery = useCallback(() => {
    downloadRecoverySnapshot(
      {
        accounts,
        transactions,
        categories,
        goals,
        profile: { userName, initialBalance: mainAccountInitialBalance, monthlyBudget },
      },
      storageIssues
    );
  }, [accounts, transactions, categories, goals, userName, mainAccountInitialBalance, monthlyBudget, storageIssues]);

  const handleSaveTransaction = useCallback(
    (data: { amount: number; categoryId: string; isIncome: boolean; accountId: string }): boolean => {
      if (!transactionAccounts.some((account) => account.id === data.accountId)) return false;
      return addTransaction(data, accounts);
    },
    [addTransaction, accounts, transactionAccounts]
  );

  const handleSaveTransfer = useCallback((draft: TransferDraft): boolean => {
    if (!canWriteAccounts || hasUnreadableTransactions) return false;
    // The transaction domain validates account existence, archival state, currency,
    // and amount in one place for every caller.
    return addTransfer(draft, accounts);
  }, [accounts, addTransfer, canWriteAccounts, hasUnreadableTransactions]);

  const handleSetMainOpeningBalance = useCallback(
    (openingBalance: number) => {
      if (!canWriteAccounts || !Number.isFinite(openingBalance)) return;
      const normalizedOpeningBalance = Math.round(openingBalance);
      if (!Number.isSafeInteger(normalizedOpeningBalance) || Math.abs(normalizedOpeningBalance) > 1_000_000_000_000) return;
      updateAccount(MAIN_ACCOUNT_ID, { initialBalance: normalizedOpeningBalance });
      // Keep the historical profile key synchronized through this single entry
      // point until the legacy profile field is removed in a separately tested migration.
      updateInitialBalance(normalizedOpeningBalance);
    },
    [canWriteAccounts, updateAccount, updateInitialBalance]
  );

  const handleUpdateAccount = useCallback(
    (id: string, updates: Partial<AccountInput>) => {
      if (id === MAIN_ACCOUNT_ID && updates.initialBalance !== undefined) {
        const { initialBalance: nextOpeningBalance, ...otherUpdates } = updates;
        handleSetMainOpeningBalance(nextOpeningBalance);
        if (Object.keys(otherUpdates).length > 0) updateAccount(id, otherUpdates);
        return;
      }
      updateAccount(id, updates);
    },
    [handleSetMainOpeningBalance, updateAccount]
  );

  const handleBalanceAdjust = useCallback(
    (targetBalance: number) => {
      if (!canWriteAccounts || !Number.isFinite(targetBalance)) return;
      const targetAccount = accounts.find((account) => account.id === balanceEditorAccountId);
      if (!targetAccount) return;
      const nextOpeningBalance = calculateAccountOpeningBalanceForTargetBalance(
        targetAccount.id,
        accounts,
        transactions,
        targetBalance,
      );
      if (targetAccount.id === MAIN_ACCOUNT_ID) handleSetMainOpeningBalance(nextOpeningBalance);
      else updateAccount(targetAccount.id, { initialBalance: nextOpeningBalance });
    },
    [canWriteAccounts, balanceEditorAccountId, accounts, transactions, handleSetMainOpeningBalance, updateAccount]
  );

  const handleUpdateTransaction = useCallback(
    (id: number, updates: { amount: number; categoryId: string; isIncome: boolean; accountId: string }): boolean =>
      updateTransaction(id, updates, accounts),
    [updateTransaction, accounts]
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

  const handleTabChange = useCallback((tab: AppTab) => {
    setVisitedTabs((previous) => {
      if (previous.has(tab)) return previous;
      const next = new Set(previous);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

  const handleOpenSettings = useCallback(() => {
    const activeElement = document.activeElement;
    settingsOpenerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) activeElement.blur();
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
    window.requestAnimationFrame(() => {
      const opener = settingsOpenerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent text-neutral-900 transition-colors duration-300 dark:text-white">
      <div hidden={isSettingsOpen} aria-hidden={isSettingsOpen}>
        <div className="relative mx-auto h-[100dvh] max-w-md overflow-hidden">
          <section
            hidden={activeTab !== 'home'}
            aria-hidden={activeTab !== 'home'}
            aria-label="Главная"
            className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar pb-32"
          >
            <MemoizedHomeScreen
              userName={userName}
              monthLabel={monthLabel}
              currentMonthKey={currentMonthKey}
              monthlyExpenses={budget.monthlyExpenses}
              monthlyBudget={monthlyBudget}
              safeToSpend={budget.safeToSpend}
              transactions={transactions}
              accounts={accounts}
              accountBalances={accountBalances}
              canWriteAccounts={canWriteAccounts}
              categories={categories}
              onOpenSettings={handleOpenSettings}
              onOpenBalance={handleOpenBalanceAdjust}
              onAddAccount={openAddAccountSheet}
              onOpenBudget={openBudgetSheet}
              onSelectTransaction={handleSelectTransaction}
            />
          </section>

          {visitedTabs.has('stats') && (
            <section
              hidden={activeTab !== 'stats'}
              aria-hidden={activeTab !== 'stats'}
              aria-label="Статистика"
              className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar pb-32"
            >
              <MemoizedStatisticsScreen
                transactions={rubTransactions}
                categories={categories}
                otherCurrencyCodes={otherCurrencyCodes}
                onSelectTransaction={handleSelectTransaction}
              />
            </section>
          )}

          {visitedTabs.has('wallet') && (
            <section
              hidden={activeTab !== 'wallet'}
              aria-hidden={activeTab !== 'wallet'}
              aria-label="Кошелёк"
              className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar pb-32"
            >
              <MemoizedWalletScreen
                accounts={accounts}
                transactions={transactions}
                accountBalances={accountBalances}
                balancesByCurrency={balancesByCurrency}
                categories={categories}
                onAddAccount={handleAddAccount}
                onUpdateAccount={handleUpdateAccount}
                onSetAccountArchived={setAccountArchived}
                onRequestTransfer={openTransferSheet}
                onSelectTransaction={handleSelectTransaction}
                canWriteAccounts={canWriteAccounts}
              />
            </section>
          )}

          {visitedTabs.has('goals') && (
            <section
              hidden={activeTab !== 'goals'}
              aria-hidden={activeTab !== 'goals'}
              aria-label="Цели"
              className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar pb-32"
            >
              <MemoizedGoalsScreen
                goals={goals}
                totalSaved={goalsTotalSaved}
                totalTarget={goalsTotalTarget}
                overallProgress={goalsOverallProgress}
                activeCount={activeGoalsCount}
                completedCount={completedGoalsCount}
                canWrite={canWriteGoals}
                onAddGoal={addGoal}
                onUpdateGoal={updateGoal}
                onDeleteGoal={deleteGoal}
                onAddProgress={addGoalProgress}
                onReduceProgress={reduceGoalProgress}
              />
            </section>
          )}
        </div>

        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddClick={openAddTransactionSheet}
        />
      </div>

      {isSettingsOpen && (
        <SettingsScreen
          onClose={handleCloseSettings}
          userName={userName}
          initialBalance={mainAccountInitialBalance}
          monthlyBudget={monthlyBudget}
          updateName={updateName}
          updateInitialBalance={handleSetMainOpeningBalance}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          backgroundStyle={backgroundStyle}
          setBackgroundStyle={setBackgroundStyle}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          goals={goals}
          addCategory={addCategory}
          updateCategory={updateCategory}
          deleteCategory={handleDeleteCategory}
          onDownloadRecovery={handleDownloadRecovery}
          storageWriteFailed={storageIssues.some((issue) => issue.kind === 'write-failed')}
        />
      )}

      <AddTransactionSheet
        open={activeSheet === 'add'}
        onClose={closeSheet}
        categories={categories}
        accounts={transactionAccounts}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveTransaction}
      />

      <TransferSheet
        open={activeSheet === 'transfer'}
        accounts={accounts}
        accountBalances={accountBalances}
        canWrite={canWriteAccounts && !hasUnreadableTransactions}
        onClose={closeSheet}
        onSave={handleSaveTransfer}
      />

      <TransactionDetailSheet
        open={activeSheet === 'detail'}
        transaction={selectedTransaction}
        categories={categories}
        accounts={accounts}
        onClose={closeSheet}
        onExited={handleDetailExited}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />

      <BalanceAdjustSheet
        open={activeSheet === 'balance'}
        onClose={closeSheet}
        accountName={balanceEditorAccount?.name ?? 'Основной счёт'}
        currency={balanceEditorAccount?.currency ?? 'RUB'}
        currentBalance={balanceEditorCurrentBalance}
        onAdjust={handleBalanceAdjust}
      />

      <AccountEditSheet
        open={activeSheet === 'account-add'}
        onClose={closeSheet}
        account={null}
        onSave={handleAddAccount}
        onSetArchived={setAccountArchived}
        canWrite={canWriteAccounts}
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
