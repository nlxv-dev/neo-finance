import { describe, expect, it } from 'vitest';
import { createDefaultAccounts, MAIN_ACCOUNT_ID } from '@/data/accounts';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  createTransactionsCsv,
  importCsvTransactionsToStorage,
  restoreJsonBackupToStorage,
  STORAGE_KEYS,
  validateBackupFile,
} from './backupService';

interface LooseBackup {
  format: string;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  data: {
    accounts?: unknown[];
    goals?: unknown[];
    transactions: unknown[];
    categories: unknown[];
    profile: {
      userName: string;
      initialBalance: number;
      monthlyBudget: number;
    };
    settings: {
      themeMode: string;
      backgroundStyle?: string;
    };
  };
}

function validBackup(): LooseBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'Neo Finance',
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: {
      accounts: createDefaultAccounts(-15_000),
      goals: [],
      transactions: [],
      categories: [],
      profile: {
        userName: 'Тест',
        initialBalance: -15_000,
        monthlyBudget: 50_000,
      },
      settings: {
        themeMode: 'dark',
        backgroundStyle: 'solid',
      },
    },
  };
}

describe('validateBackupFile', () => {
  it('starts new backups with an empty goals list and restores it atomically', () => {
    const input = validBackup();
    input.data.goals = [{
      id: 'goal-trip', name: 'Отпуск', targetAmount: 100_000, currentAmount: 25_000,
      iconName: 'Plane', color: 'mint', deadline: '2027-06-01', createdAt: '2026-10-26T00:00:00.000Z',
    }];
    const backup = validateBackupFile(input);
    expect(backup.data.goals).toHaveLength(1);
    expect(backup.data.goals[0].currentAmount).toBe(25_000);
  });

  it('rejects malformed goals instead of silently dropping them', () => {
    const input = validBackup();
    input.data.goals = [{ id: 'bad', name: '', targetAmount: 10, currentAmount: -2, iconName: 'NoSuchIcon', color: 'cobalt' }];
    expect(() => validateBackupFile(input)).toThrow(/список целей|цель/i);
  });

  it('adds an empty goals list when upgrading version-3 backups', () => {
    const input = validBackup();
    input.schemaVersion = 3;
    delete input.data.goals;
    const backup = validateBackupFile(input);
    expect(backup.schemaVersion).toBe(4);
    expect(backup.data.goals).toEqual([]);
  });

  it('accepts a negative initial balance and the selected background style', () => {
    const backup = validateBackupFile(validBackup());

    expect(backup.data.profile.initialBalance).toBe(-15_000);
    expect(backup.data.settings.backgroundStyle).toBe('solid');
  });

  it('keeps older backups compatible by defaulting their background to gradient', () => {
    const input = validBackup();
    input.schemaVersion = 1;
    delete input.data.accounts;
    delete input.data.settings.backgroundStyle;

    expect(validateBackupFile(input).data.settings.backgroundStyle).toBe('gradient');
    expect(validateBackupFile(input).data.accounts).toEqual(createDefaultAccounts(-15_000));
  });

  it('preserves accounts in schema-version-3 backups and uses their main opening balance as canonical', () => {
    const input = validBackup();
    input.schemaVersion = 3;
    input.data.accounts = [
      ...createDefaultAccounts(-10_000),
      {
        id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins',
        currency: 'RUB', initialBalance: 2_000, isArchived: false,
      },
    ];
    input.data.profile.initialBalance = 123;

    const backup = validateBackupFile(input);
    expect(backup.schemaVersion).toBe(4);
    expect(backup.data.accounts).toHaveLength(2);
    expect(backup.data.profile.initialBalance).toBe(-10_000);
  });

  it('rejects a non-positive monthly budget', () => {
    const input = validBackup();
    input.data.profile.monthlyBudget = 0;

    expect(() => validateBackupFile(input)).toThrow(/больше нуля/);
  });

  it('rejects an unknown backup format', () => {
    const input = validBackup();
    input.format = 'another-app';

    expect(() => validateBackupFile(input)).toThrow(/поддерживаемого формата/);
  });

  it('rejects an unsupported theme', () => {
    const input = validBackup();
    input.data.settings.themeMode = 'neon';

    expect(() => validateBackupFile(input)).toThrow(/неизвестная тема/);
  });

  it('rejects an unsupported background style', () => {
    const input = validBackup();
    input.data.settings.backgroundStyle = 'image';

    expect(() => validateBackupFile(input)).toThrow(/неизвестный стиль фона/);
  });

  it('migrates older backup transactions to the main account and preserves explicit account references', () => {
    const input = validBackup();
    input.data.accounts = [
      ...createDefaultAccounts(-15_000),
      { id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 0, isArchived: false },
    ];
    input.data.transactions = [
      {
        id: 1,
        amount: 250,
        categoryId: 'cat-food',
        category: 'Продукты',
        categoryIconName: 'ShoppingCart',
        date: '25 окт',
        isIncome: false,
      },
      {
        id: 2,
        amount: 100,
        categoryId: 'cat-salary',
        category: 'Зарплата',
        categoryIconName: 'BriefcaseBusiness',
        date: '25 окт',
        isIncome: true,
        accountId: 'acc-cash',
      },
    ];

    const backup = validateBackupFile(input);
    expect(backup.data.transactions.map((transaction) => transaction.accountId)).toEqual([
      MAIN_ACCOUNT_ID,
      'acc-cash',
    ]);
  });

  it('upgrades schema-version-1 transaction history into one main account without losing rows', () => {
    const input = validBackup();
    input.schemaVersion = 1;
    delete input.data.accounts;
    input.data.transactions = [{
      id: 7, amount: 50, categoryId: null, category: 'Прочее', categoryIconName: 'HelpCircle',
      date: '1 янв', isIncome: false, accountId: 'acc-legacy-cash',
    }];

    const backup = validateBackupFile(input);
    expect(backup.schemaVersion).toBe(4);
    expect(backup.data.accounts).toEqual(createDefaultAccounts(-15_000));
    expect(backup.data.transactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
  });

  it('rejects invalid transaction account references in a backup', () => {
    const input = validBackup();
    input.data.transactions = [{
      id: 1,
      amount: 250,
      categoryId: null,
      category: 'Продукты',
      categoryIconName: 'ShoppingCart',
      date: '25 окт',
      isIncome: false,
      accountId: 7,
    }];

    expect(() => validateBackupFile(input)).toThrow(/Счёт транзакции/);
  });

  it('restores accounts, goals, and transactions atomically from a current schema-4 backup', () => {
    const input = validBackup();
    input.data.goals = [{
      id: 'goal-trip', name: 'Отпуск', targetAmount: 80_000, currentAmount: 20_000,
      iconName: 'Plane', color: 'mint', createdAt: '2026-10-26T00:00:00.000Z',
    }];
    input.data.accounts = [
      ...createDefaultAccounts(-10_000),
      { id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 2_000, isArchived: false },
    ];
    input.data.transactions = [
      {
        id: 1, amount: 100, categoryId: null, category: 'Прочее', categoryIconName: 'HelpCircle',
        date: '25 окт', isIncome: false, accountId: 'acc-cash',
      },
      {
        id: 2, amount: 300, categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight',
        date: '25 окт', isIncome: false, isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash',
      },
    ];
    window.localStorage.clear();

    restoreJsonBackupToStorage(input);

    const storedAccounts = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.accounts) || '[]');
    const storedTransactions = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
    expect(storedAccounts).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.goals) || 'null')).toMatchObject([{ id: 'goal-trip', currentAmount: 20_000 }]);
    expect(storedAccounts[0].initialBalance).toBe(-10_000);
    expect(storedTransactions[0].accountId).toBe('acc-cash');
    expect(storedTransactions[1]).toMatchObject({ isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' });
    expect(window.localStorage.getItem(STORAGE_KEYS.initialBalance)).toBe('-10000');
  });

  it('restores schema-version-1 backups by creating one main account, preserving the legacy balance, and clearing stale goals', () => {
    const input = validBackup();
    input.schemaVersion = 1;
    delete input.data.accounts;
    delete input.data.goals;
    input.data.transactions = [{
      id: 2, amount: 100, categoryId: null, category: 'Прочее', categoryIconName: 'HelpCircle',
      date: '25 окт', isIncome: false,
    }];
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify([{ id: 'stale-goal' }]));

    restoreJsonBackupToStorage(input);

    const storedAccounts = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.accounts) || '[]');
    const storedTransactions = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
    expect(storedAccounts).toEqual(createDefaultAccounts(-15_000));
    expect(storedTransactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.goals) || 'null')).toEqual([]);
  });

  it('rejects non-finite transaction amounts', () => {
    const input = validBackup();
    input.data.transactions = [
      {
        id: 1,
        amount: Number.NaN,
        categoryId: null,
        category: 'Продукты',
        categoryIconName: 'ShoppingCart',
        date: '1 янв',
        isIncome: false,
      },
    ];

    expect(() => validateBackupFile(input)).toThrow(/сумма транзакции/);
  });

  it('upgrades schema-version-2 backups without losing accounts or ordinary transactions', () => {
    const input = validBackup();
    input.schemaVersion = 2;
    input.data.transactions = [{
      id: 4, amount: 25, categoryId: null, category: 'Прочее', categoryIconName: 'HelpCircle',
      date: '2 окт', isIncome: false, accountId: MAIN_ACCOUNT_ID,
    }];

    const backup = validateBackupFile(input);
    expect(backup.schemaVersion).toBe(4);
    expect(backup.data.transactions[0].accountId).toBe(MAIN_ACCOUNT_ID);
    expect(backup.data.transactions[0].isTransfer).toBeUndefined();
  });

  it('validates and preserves an internal transfer in schema-version-3 JSON backups and upgrades it', () => {
    const input = validBackup();
    input.data.accounts = [
      ...createDefaultAccounts(1_000),
      { id: 'acc-cash', name: 'Наличные', type: 'cash', iconName: 'Coins', currency: 'RUB', initialBalance: 500, isArchived: false },
    ];
    input.data.transactions = [{
      id: 9, amount: 200, categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight',
      date: '25 окт', isIncome: false, isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash',
    }];

    const backup = validateBackupFile(input);
    expect(backup.data.transactions[0]).toMatchObject({ isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash', isIncome: false });
  });

  it('rejects transfers between different currencies or unknown destination accounts', () => {
    const input = validBackup();
    input.data.accounts = [
      ...createDefaultAccounts(1_000),
      { id: 'acc-usd', name: 'USD', type: 'bank', iconName: 'Landmark', currency: 'USD', initialBalance: 100, isArchived: false },
    ];
    input.data.transactions = [{
      id: 10, amount: 100, categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight',
      date: '25 окт', isIncome: false, isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-usd',
    }];

    expect(() => validateBackupFile(input)).toThrow(/неверный счёт или переводит между разными валютами/);
  });

  it('keeps the existing CSV columns but excludes transfers that CSV cannot represent', () => {
    const csv = createTransactionsCsv([
      { id: 1, title: 'Еда', categoryId: 'food', category: 'Еда', categoryIconName: 'Utensils', amount: 50, date: '25 окт', accountId: MAIN_ACCOUNT_ID, isIncome: false },
      { id: 2, title: 'Перевод', categoryId: null, category: 'Перевод', categoryIconName: 'ArrowLeftRight', amount: 20, date: '25 окт', accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash', isIncome: false, isTransfer: true },
    ]);
    expect(csv.split('\r\n')[0]).toBe('\uFEFF"id","amount","type","categoryId","category","categoryIconName","date","dateISO"');
    expect(csv).toContain('"Еда"');
    expect(csv).not.toContain('"Перевод"');
  });

  it('preserves internal transfers on CSV replace and resolves transaction ID collisions safely', () => {
    window.localStorage.clear();
    const existingTransfer = {
      id: 12,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: 200,
      date: '25 окт',
      dateISO: '2026-10-25',
      accountId: MAIN_ACCOUNT_ID,
      toAccountId: 'acc-cash',
      isIncome: false,
      isTransfer: true,
    };
    const importedExpense = {
      id: 12,
      title: 'Продукты',
      categoryId: 'cat-food',
      category: 'Продукты',
      categoryIconName: 'ShoppingCart',
      amount: 50,
      date: '25 окт',
      dateISO: '2026-10-25',
      accountId: MAIN_ACCOUNT_ID,
      isIncome: false,
    };

    importCsvTransactionsToStorage([importedExpense], [existingTransfer], [], 'replace');

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ id: 12, category: 'Продукты' });
    expect(stored[0].isTransfer).toBeUndefined();
    expect(stored[1]).toMatchObject({
      category: 'Перевод',
      isTransfer: true,
      accountId: MAIN_ACCOUNT_ID,
      toAccountId: 'acc-cash',
    });
    expect(new Set(stored.map((transaction: { id: number }) => transaction.id)).size).toBe(2);
  });

});
