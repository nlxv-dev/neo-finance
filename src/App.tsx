import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { calculateAccountOpeningBalanceForTargetBalance, calculateAllAccountBalances } from '@/utils/financialMath';
import { filterTransactionsForCurrency, getOtherCurrencyCodes } from '@/utils/accountAnalytics';
import { downloadRecoverySnapshot, requestPersistentStorage } from '@/storage/safeLocalStorage';

type ActiveSheet = 'add' | 'detail' | 'transfer' | 'profile' | 'budget' | 'balance' | 'account-add' | null;

function App() {
  const { themeMode, setThemeMode, backgroundStyle, setBackgroundStyle } = useTheme();

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<Transaction['id'] | null>(null);
  const [activeHomeCardKey, setActiveHomeCardKey] = useState<string>(MAIN_ACCOUNT_ID);
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

  const handleAddAccount = useCallback((input: AccountInput) => {
    const createdAccount = addAccount(input);
    if (createdAccount) setActiveHomeCardKey(createdAccount.id);
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
    (data: { amount: number; categoryId: string; isIncome: boolean; accountId: string }) => {
      const targetAccountId = transactionAccounts.some((account) => account.id === data.accountId)
        ? data.accountId
        : MAIN_ACCOUNT_ID;
      addTransaction({ ...data, accountId: targetAccountId });
      closeSheet();
    },
    [addTransaction, closeSheet, transactionAccounts]
  );

  const handleSaveTransfer = useCallback((draft: TransferDraft): boolean => {
    if (!canWriteAccounts || hasUnreadableTransactions) return false;
    const source = accounts.find((account) => account.id === draft.fromAccountId && !account.isArchived);
    const destination = accounts.find((account) => account.id === draft.toAccountId && !account.isArchived);
    if (
      !source || !destination || source.id === destination.id ||
      source.currency.toUpperCase() !== destination.currency.toUpperCase() ||
      !Number.isSafeInteger(draft.amount) || draft.amount <= 0
    ) return false;
    addTransfer(draft);
    return true;
  }, [accounts, addTransfer, canWriteAccounts, hasUnreadableTransactions]);

  const handleUpdateAccount = useCallback(
    (id: string, updates: Partial<AccountInput>) => {
      updateAccount(id, updates);
      // Keep the historic profile opening-balance key in sync when the main
      // account is edited from Wallet, not only from the balance sheet.
      if (id === MAIN_ACCOUNT_ID && updates.initialBalance !== undefined && Number.isFinite(updates.initialBalance)) {
        updateInitialBalance(Math.round(updates.initialBalance));
      }
    },
    [updateAccount, updateInitialBalance]
  );

  const handleSetMainOpeningBalance = useCallback(
    (openingBalance: number) => {
      if (!canWriteAccounts || !Number.isFinite(openingBalance)) return;
      const normalizedOpeningBalance = Math.round(openingBalance);
      updateAccount(MAIN_ACCOUNT_ID, { initialBalance: normalizedOpeningBalance });
      // Keep the historical profile key synchronized for old backups and compatibility.
      updateInitialBalance(normalizedOpeningBalance);
    },
    [canWriteAccounts, updateAccount, updateInitialBalance]
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
      updateAccount(targetAccount.id, { initialBalance: nextOpeningBalance });
      if (targetAccount.id === MAIN_ACCOUNT_ID) updateInitialBalance(nextOpeningBalance);
    },
    [canWriteAccounts, balanceEditorAccountId, accounts, transactions, updateAccount, updateInitialBalance]
  );

  const handleUpdateTransaction = useCallback(
    (id: number, updates: { amount: number; categoryId: string; isIncome: boolean; accountId: string }) => {
      const currentTransaction = transactions.find((transaction) => transaction.id === id);
      const currentAccount = accounts.find((account) => account.id === (currentTransaction?.accountId ?? MAIN_ACCOUNT_ID));
      const nextAccount = accounts.find((account) => account.id === updates.accountId);
      const safeAccountId = nextAccount && currentAccount && nextAccount.currency === currentAccount.currency
        ? nextAccount.id
        : currentTransaction?.accountId ?? MAIN_ACCOUNT_ID;
      updateTransaction(id, { ...updates, accountId: safeAccountId });
    },
    [updateTransaction, transactions, accounts]
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
      ) : (
        <>
          <div className="relative mx-auto min-h-screen max-w-md overflow-y-auto no-scrollbar pb-32">
            {activeTab === 'stats' ? (
              <StatisticsScreen
                transactions={rubTransactions}
                categories={categories}
                otherCurrencyCodes={otherCurrencyCodes}
                onSelectTransaction={handleSelectTransaction}
              />
            ) : activeTab === 'wallet' ? (
              <WalletScreen
                accounts={accounts}
                transactions={transactions}
                categories={categories}
                onAddAccount={handleAddAccount}
                onUpdateAccount={handleUpdateAccount}
                onSetAccountArchived={setAccountArchived}
                onRequestTransfer={() => setActiveSheet('transfer')}
                onSelectTransaction={handleSelectTransaction}
                canWriteAccounts={canWriteAccounts}
                fallbackInitialBalance={mainAccountInitialBalance}
              />
            ) : activeTab === 'goals' ? (
              <GoalsScreen
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
            ) : (
              <HomeScreen
                userName={userName}
                monthLabel={monthLabel}
                currentMonthKey={currentMonthKey}
                monthlyExpenses={budget.monthlyExpenses}
                monthlyBudget={monthlyBudget}
                safeToSpend={budget.safeToSpend}
                transactions={transactions}
                accounts={accounts}
                accountBalances={accountBalances}
                activeCardKey={activeHomeCardKey}
                canWriteAccounts={canWriteAccounts}
                categories={categories}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSelectCard={setActiveHomeCardKey}
                onOpenBalance={handleOpenBalanceAdjust}
                onAddAccount={() => setActiveSheet('account-add')}
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
        accounts={transactionAccounts}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSave={handleSaveTransaction}
      />

      <TransferSheet
        open={activeSheet === 'transfer'}
        accounts={accounts}
        accountBalances={calculateAllAccountBalances(accounts, transactions)}
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
