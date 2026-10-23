import { useMemo } from 'react';
import { getBudgetStatus, type BudgetStatus, type Transaction } from '@/data/mockData';
import { resolveTransactionDateISO } from '@/data/transactionDates';

export interface BudgetSummary {
  currentMonthTransactions: Transaction[];
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyGrowth: number;
  safeToSpend: number;
  budgetPercent: number;
  budgetStatus: BudgetStatus;
  isOverbudget: boolean;
  progressGradient: string;
  progressWidth: number;
}

const PROGRESS_GRADIENTS: Record<BudgetStatus, string> = {
  normal: 'from-mint to-indigoblue',
  warning: 'from-amber-500 to-orange-400',
  overbudget: 'from-red-500 to-red-500',
};

/**
 * Derives every dashboard aggregate in a single pass so App stays a dispatcher.
 */
export function useBudgetSummary(
  transactions: Transaction[],
  monthlyBudget: number,
  currentMonthKey: string
): BudgetSummary {
  return useMemo(() => {
    const currentMonthTransactions: Transaction[] = [];
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    for (const transaction of transactions) {
      const dateISO = resolveTransactionDateISO(transaction);
      if (!dateISO?.startsWith(currentMonthKey)) continue;

      currentMonthTransactions.push(transaction);
      if (transaction.isIncome) monthlyIncome += transaction.amount;
      else monthlyExpenses += transaction.amount;
    }

    const monthlyGrowth = monthlyIncome - monthlyExpenses;
    const safeToSpend = monthlyBudget - monthlyExpenses;
    const budgetPercent = monthlyBudget > 0 ? (monthlyExpenses / monthlyBudget) * 100 : 0;
    const budgetStatus = getBudgetStatus(monthlyExpenses, monthlyBudget);

    return {
      currentMonthTransactions,
      monthlyIncome,
      monthlyExpenses,
      monthlyGrowth,
      safeToSpend,
      budgetPercent,
      budgetStatus,
      isOverbudget: monthlyExpenses > monthlyBudget,
      progressGradient: PROGRESS_GRADIENTS[budgetStatus],
      progressWidth: Math.min(100, budgetPercent),
    };
  }, [transactions, monthlyBudget, currentMonthKey]);
}
