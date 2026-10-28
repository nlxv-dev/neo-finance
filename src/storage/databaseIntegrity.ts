import {
  DEFAULT_ACCOUNT_CURRENCY,
  MAIN_ACCOUNT_ID,
  normalizeStoredAccounts,
} from '@/data/accounts';
import { normalizeStoredCategories } from '@/data/categories';
import { normalizeStoredGoals } from '@/data/goals';
import { normalizeStoredTransactions } from '@/data/transactions';
import { getTransactionRuleError } from '@/data/transactionRules';

export interface DatabaseIntegrityInput {
  transactions: unknown;
  accounts: unknown;
  categories: unknown;
  goals: unknown;
  /** Transfers from a legacy backup that were intentionally preserved unresolved. */
  unresolvedTransferIds?: readonly number[];
}

function invalid(message: string): never {
  throw new Error(`Проверка целостности базы Neo Finance не пройдена: ${message} Данные не изменены. Восстановите приложение из актуального JSON-бэкапа.`);
}

/**
 * Validates persisted IndexedDB records without repairing or rewriting them.
 * This is deliberately read-only: an integrity issue must never be silently
 * "fixed" by normalizing financial history during startup or backup export.
 */
export function assertDatabaseIntegrity(input: DatabaseIntegrityInput): void {
  const accounts = normalizeStoredAccounts(input.accounts);
  if (!accounts) invalid('список счетов имеет неверную структуру.');

  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  if (!mainAccount || mainAccount.isArchived || mainAccount.currency !== DEFAULT_ACCOUNT_CURRENCY) {
    invalid('отсутствует активный основной счёт в RUB.');
  }

  const categories = normalizeStoredCategories(input.categories);
  if (!categories) invalid('список категорий повреждён.');

  const goals = normalizeStoredGoals(input.goals);
  if (!goals) invalid('список целей повреждён.');

  const transactions = normalizeStoredTransactions(input.transactions, categories);
  if (!transactions) invalid('история операций повреждена или содержит некорректные записи.');

  const unresolvedTransferIds = new Set(input.unresolvedTransferIds ?? []);
  for (const transaction of transactions) {
    const linkedCategory = transaction.categoryId
      ? categories.find((category) => category.id === transaction.categoryId)
      : undefined;

    if (linkedCategory && linkedCategory.isIncome !== transaction.isIncome) {
      invalid(`операция №${transaction.id} не соответствует типу связанной категории.`);
    }

    // Stage 1 preserves historically unresolved transfers with their original
    // endpoints and records their IDs in the migration marker. Do not rewrite or
    // block those known rows; all other records must satisfy current rules.
    if (transaction.isTransfer && unresolvedTransferIds.has(transaction.id)) continue;

    const ruleError = getTransactionRuleError(transaction, accounts);
    if (ruleError) invalid(`операция №${transaction.id}: ${ruleError}`);
  }
}
