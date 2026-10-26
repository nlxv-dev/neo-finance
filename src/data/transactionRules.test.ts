import { describe, expect, it } from 'vitest';
import { createDefaultAccounts, type Account } from '@/data/accounts';
import { getTransactionRuleError } from './transactionRules';

const accounts: Account[] = [
  ...createDefaultAccounts(5_000),
  { id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 0, isArchived: false },
  { id: 'acc-usd', name: 'USD', type: 'bank', iconName: 'Landmark', currency: 'USD', initialBalance: 0, isArchived: false },
  { id: 'acc-archived', name: 'Архив', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 0, isArchived: true },
];

describe('shared transaction rules', () => {
  it('accepts a regular whole-ruble transaction on an active account', () => {
    expect(getTransactionRuleError({ amount: 250, accountId: 'acc-cash', isIncome: false }, accounts, { requireActiveAccounts: true })).toBeNull();
  });

  it.each([0, -1, 1.5, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1])('rejects invalid transaction amount %s', (amount) => {
    expect(getTransactionRuleError({ amount, accountId: 'acc-main', isIncome: false }, accounts)).not.toBeNull();
  });

  it('accepts a same-currency transfer and rejects self, missing, archived and cross-currency destinations', () => {
    const base = { amount: 100, accountId: 'acc-main', isIncome: false, isTransfer: true };
    expect(getTransactionRuleError({ ...base, toAccountId: 'acc-cash' }, accounts, { requireActiveAccounts: true })).toBeNull();
    expect(getTransactionRuleError({ ...base, toAccountId: 'acc-main' }, accounts)).toMatch(/отличаться/);
    expect(getTransactionRuleError({ ...base, toAccountId: 'missing' }, accounts)).toMatch(/не существует/);
    expect(getTransactionRuleError({ ...base, toAccountId: 'acc-usd' }, accounts)).toMatch(/разн.*валют/);
    expect(getTransactionRuleError({ ...base, toAccountId: 'acc-archived' }, accounts, { requireActiveAccounts: true })).toMatch(/архивный/);
  });

  it('rejects a transfer marked as income and a destination on regular transactions', () => {
    expect(getTransactionRuleError({ amount: 100, accountId: 'acc-main', toAccountId: 'acc-cash', isIncome: false }, accounts)).toMatch(/счёта назначения/);
    expect(getTransactionRuleError({ amount: 100, accountId: 'acc-main', toAccountId: 'acc-cash', isIncome: true, isTransfer: true }, accounts)).toMatch(/доходом/);
  });
});
