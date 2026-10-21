import { describe, it, expect } from 'vitest';
import { validateBackupFile } from './backupService';

describe('backupService', () => {
  const validBackup = {
    format: 'neo-finance-backup',
    schemaVersion: 1,
    exportedAt: '2026-10-21T07:00:00.000Z',
    data: {
      profile: {
        userName: 'Алексей',
        initialBalance: 75000,
        monthlyBudget: 60000,
      },
      settings: {
        themeMode: 'dark',
      },
      categories: [
        { id: 'cat-1', name: 'Продукты', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
        { id: 'cat-2', name: 'Зарплата', iconName: 'Banknote', isIncome: true, isArchived: false },
      ],
      accounts: [
        {
          id: 'acc-main',
          name: 'Основной счёт',
          type: 'card',
          iconName: 'CreditCard',
          currency: 'RUB',
          initialBalance: 50000,
          isArchived: false,
          color: '#3B82F6',
        },
        {
          id: 'acc-savings',
          name: 'Копилка',
          type: 'savings',
          iconName: 'PiggyBank',
          currency: 'RUB',
          initialBalance: 25000,
          isArchived: false,
          color: '#10B981',
        },
      ],
      transactions: [
        {
          id: 101,
          title: 'Супермаркет',
          amount: 3200,
          isIncome: false,
          categoryId: 'cat-1',
          category: 'Продукты',
          categoryIconName: 'ShoppingCart',
          date: '15 окт',
          dateISO: '2026-10-15',
          accountId: 'acc-main',
        },
        {
          id: 102,
          title: 'Перевод в копилку',
          amount: 10000,
          isIncome: false,
          categoryId: null,
          category: 'Перевод',
          categoryIconName: 'ArrowLeftRight',
          date: '16 окт',
          dateISO: '2026-10-16',
          accountId: 'acc-main',
          toAccountId: 'acc-savings',
          isTransfer: true,
        },
      ],
    },
  };

  it('validates a complete backup with accounts and transfers', () => {
    const validated = validateBackupFile(validBackup);
    expect(validated.data.accounts).toHaveLength(2);
    expect(validated.data.accounts?.[0].id).toBe('acc-main');
    expect(validated.data.accounts?.[1].name).toBe('Копилка');

    expect(validated.data.transactions).toHaveLength(2);
    expect(validated.data.transactions[1].isTransfer).toBe(true);
    expect(validated.data.transactions[1].accountId).toBe('acc-main');
    expect(validated.data.transactions[1].toAccountId).toBe('acc-savings');
  });

  it('maintains backwards compatibility when accounts is omitted', () => {
    const legacyBackup = {
      ...validBackup,
      data: {
        ...validBackup.data,
        accounts: undefined,
      },
    };

    const validated = validateBackupFile(legacyBackup);
    expect(validated.data.accounts).toBeUndefined();
    expect(validated.data.transactions).toHaveLength(2);
  });

  it('throws descriptive error on duplicate account IDs', () => {
    const duplicateAccountsBackup = {
      ...validBackup,
      data: {
        ...validBackup.data,
        accounts: [
          { ...validBackup.data.accounts[0] },
          { ...validBackup.data.accounts[0] },
        ],
      },
    };

    expect(() => validateBackupFile(duplicateAccountsBackup)).toThrowError(
      /повторяется ID счёта/
    );
  });

  it('throws error on unsupported backup format or invalid schema', () => {
    expect(() => validateBackupFile({ format: 'invalid-format' })).toThrowError();
    expect(() => validateBackupFile(null)).toThrowError();
    expect(() => validateBackupFile({ ...validBackup, schemaVersion: 999 })).toThrowError();
  });
});
