import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAccounts, MAIN_ACCOUNT_ID, type Account } from '@/data/accounts';
import { DEFAULT_CATEGORIES, type CustomCategory } from '@/data/categories';
import type { Goal } from '@/data/goals';
import type { Transaction } from '@/data/mockData';
import { NeoFinanceDatabase } from '@/db/neoFinanceDb';
import {
  LEGACY_MIGRATION_META_KEY,
  LegacyMigrationError,
  buildLegacyMigrationDataset,
  migrateLegacyLocalStorageToDexie,
  type LegacyStorageReader,
} from './legacyStorageMigration';
import { DEXIE_PRIMARY_MARKER_KEY, DEXIE_PRIMARY_MARKER_VALUE, LAST_BACKUP_KEY, RECOVERY_KEYS, STORAGE_KEYS } from './storageKeys';

class MemoryStorage implements LegacyStorageReader {
  readonly values: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let db: NeoFinanceDatabase;
let databaseNumber = 0;

beforeEach(() => {
  databaseNumber += 1;
  db = new NeoFinanceDatabase(`neo-finance-migration-test-${databaseNumber}`);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

function completeLegacyStorage() {
  const accounts: Account[] = [
    ...createDefaultAccounts(7_500),
    {
      id: 'acc-cash',
      name: 'Наличные',
      type: 'cash',
      iconName: 'Coins',
      currency: 'RUB',
      initialBalance: 2_000,
      isArchived: false,
      color: 'amber',
    },
    {
      id: 'acc-archived',
      name: 'Старый счёт',
      type: 'bank',
      iconName: 'Landmark',
      currency: 'RUB',
      initialBalance: 500,
      isArchived: true,
    },
  ];
  const categories: CustomCategory[] = DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    isArchived: category.id === 'def-1',
  }));
  const transactions: Transaction[] = [
    {
      id: 1001,
      title: 'Продукты',
      categoryId: 'def-1',
      category: 'Продукты',
      categoryIconName: 'ShoppingCart',
      amount: 750,
      date: '26 окт',
      dateISO: '2026-10-26',
      accountId: 'acc-cash',
      isIncome: false,
    },
    {
      id: 1002,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: 300,
      date: '25 окт',
      dateISO: '2026-10-25',
      accountId: MAIN_ACCOUNT_ID,
      toAccountId: 'acc-cash',
      isIncome: false,
      isTransfer: true,
    },
  ];
  const goal: Goal = {
    id: 'goal-trip',
    name: 'Путешествие',
    targetAmount: 100_000,
    currentAmount: 20_000,
    iconName: 'Plane',
    color: 'mint',
    deadline: '2027-06-01',
    notes: 'Летний отпуск',
    createdAt: '2026-10-01T00:00:00.000Z',
  };
  const values: Record<string, string> = {
    [STORAGE_KEYS.transactions]: JSON.stringify(transactions),
    [STORAGE_KEYS.accounts]: JSON.stringify(accounts),
    [STORAGE_KEYS.categories]: JSON.stringify(categories),
    [STORAGE_KEYS.goals]: JSON.stringify([goal]),
    [STORAGE_KEYS.userName]: 'Тестовый пользователь',
    // Deliberately diverges from acc-main: the account record is canonical.
    [STORAGE_KEYS.initialBalance]: '1234',
    [STORAGE_KEYS.monthlyBudget]: '60000',
    [STORAGE_KEYS.theme]: 'dark',
    [STORAGE_KEYS.backgroundStyle]: 'solid',
    [LAST_BACKUP_KEY]: '2026-10-20T10:00:00.000Z',
  };
  return { values, accounts, categories, transactions, goal };
}

describe('buildLegacyMigrationDataset', () => {
  it('builds safe defaults for a first install without writing to storage', () => {
    const storage = new MemoryStorage();
    const dataset = buildLegacyMigrationDataset(storage);

    expect(dataset.source).toBe('new-install');
    expect(dataset.accounts).toEqual(createDefaultAccounts(0));
    expect(dataset.categories).toEqual(DEFAULT_CATEGORIES);
    expect(dataset.transactions).toEqual([]);
    expect(dataset.goals).toEqual([]);
    expect(dataset.profile).toEqual({ userName: 'Пользователь', initialBalance: 0, monthlyBudget: 50_000 });
    expect(dataset.settings).toEqual({ themeMode: 'light', backgroundStyle: 'gradient' });
    expect(storage.values.size).toBe(0);
  });

  it('uses account opening balance as canonical when legacy profile balance differs', () => {
    const { values } = completeLegacyStorage();
    const dataset = buildLegacyMigrationDataset(new MemoryStorage(values));

    expect(dataset.profile.initialBalance).toBe(7_500);
    expect(dataset.settings).toEqual({ themeMode: 'dark', backgroundStyle: 'solid' });
    expect(dataset.lastBackupAt).toBe('2026-10-20T10:00:00.000Z');
  });

  it('rejects malformed financial JSON instead of falling back to empty data', () => {
    const storage = new MemoryStorage({ [STORAGE_KEYS.transactions]: '{not-json' });

    expect(() => buildLegacyMigrationDataset(storage)).toThrowError(LegacyMigrationError);
    expect(() => buildLegacyMigrationDataset(storage)).toThrow(/повреждённый JSON/);
    expect(storage.values.get(STORAGE_KEYS.transactions)).toBe('{not-json');
  });

  it('rejects invalid monthly-budget values without silently substituting the default', () => {
    const storage = new MemoryStorage({ [STORAGE_KEYS.monthlyBudget]: 'NaN' });

    expect(() => buildLegacyMigrationDataset(storage)).toThrowError(LegacyMigrationError);
    expect(storage.values.get(STORAGE_KEYS.monthlyBudget)).toBe('NaN');
  });

  it('rejects an inaccessible legacy storage reader instead of treating it as a first install', () => {
    const storage: LegacyStorageReader = {
      getItem: () => { throw new Error('storage unavailable'); },
    };

    let caught: unknown;
    try {
      buildLegacyMigrationDataset(storage);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LegacyMigrationError);
    expect(caught).toMatchObject({ code: 'storage-unavailable' });
  });

  it('reports unresolved transfer endpoints without rewriting the transfer as self-transfer', () => {
    const source = completeLegacyStorage();
    const transactions = [...source.transactions, {
      id: 1003,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: 120,
      date: '24 окт',
      dateISO: '2026-10-24',
      accountId: 'missing-source',
      toAccountId: 'missing-destination',
      isIncome: false,
      isTransfer: true,
    } satisfies Transaction];
    source.values[STORAGE_KEYS.transactions] = JSON.stringify(transactions);

    const dataset = buildLegacyMigrationDataset(new MemoryStorage(source.values));
    expect(dataset.unresolvedTransferIds).toEqual([1003]);
    expect(dataset.transactions.find((transaction) => transaction.id === 1003)?.accountId).toBe('missing-source');
    expect(dataset.transactions.find((transaction) => transaction.id === 1003)?.toAccountId).toBe('missing-destination');
  });
});

describe('migrateLegacyLocalStorageToDexie', () => {
  it('seeds the existing first-install defaults in Dexie', async () => {
    const storage = new MemoryStorage();
    const result = await migrateLegacyLocalStorageToDexie({ db, storage });

    expect(result).toEqual({
      status: 'migrated',
      source: 'new-install',
      counts: { transactions: 0, accounts: 1, categories: 5, goals: 0 },
    });
    expect(await db.accounts.get(MAIN_ACCOUNT_ID)).toMatchObject({ initialBalance: 0, isArchived: false });
    expect(await db.categories.count()).toBe(5);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.goals.count()).toBe(0);
    expect(storage.values.get(DEXIE_PRIMARY_MARKER_KEY)).toBe(DEXIE_PRIMARY_MARKER_VALUE);
    expect(storage.values.size).toBe(1);
  });

  it('migrates all tables atomically, preserves IDs and never modifies legacy storage', async () => {
    const source = completeLegacyStorage();
    const storage = new MemoryStorage(source.values);
    const before = new Map(storage.values);

    const result = await migrateLegacyLocalStorageToDexie({
      db,
      storage,
      now: () => new Date('2026-10-26T12:00:00.000Z'),
    });

    expect(result).toEqual({
      status: 'migrated',
      source: 'localStorage',
      counts: { transactions: 2, accounts: 3, categories: 5, goals: 1 },
    });
    expect(await db.transactions.get(1001)).toMatchObject({ id: 1001, accountId: 'acc-cash', categoryId: 'def-1' });
    expect(await db.transactions.get(1002)).toMatchObject({ isTransfer: true, accountId: MAIN_ACCOUNT_ID, toAccountId: 'acc-cash' });
    expect(await db.accounts.get(MAIN_ACCOUNT_ID)).toMatchObject({ initialBalance: 7_500 });
    expect(await db.accounts.get('acc-archived')).toMatchObject({ isArchived: true, initialBalance: 500 });
    expect(await db.categories.get('def-1')).toMatchObject({ isArchived: true });
    expect(await db.goals.get('goal-trip')).toMatchObject({ currentAmount: 20_000 });
    expect((await db.appState.get('profile'))?.value).toEqual({ userName: 'Тестовый пользователь', monthlyBudget: 60_000 });
    expect((await db.appState.get('settings'))?.value).toEqual({ themeMode: 'dark', backgroundStyle: 'solid' });
    expect((await db.appState.get('lastBackupAt'))?.value).toBe('2026-10-20T10:00:00.000Z');
    expect(await db.meta.get(LEGACY_MIGRATION_META_KEY)).toMatchObject({
      key: LEGACY_MIGRATION_META_KEY,
      value: { status: 'completed', migrationVersion: 1, counts: result.counts },
    });
    for (const [key, value] of before) expect(storage.values.get(key)).toBe(value);
    expect(storage.values.get(DEXIE_PRIMARY_MARKER_KEY)).toBe(DEXIE_PRIMARY_MARKER_VALUE);
    expect(RECOVERY_KEYS).toHaveLength(10);
  });

  it('blocks stale LocalStorage re-import if Dexie was previously primary but its database marker was lost', async () => {
    const source = completeLegacyStorage();
    const storage = new MemoryStorage(source.values);
    await migrateLegacyLocalStorageToDexie({ db, storage });
    expect(storage.getItem(DEXIE_PRIMARY_MARKER_KEY)).toBe(DEXIE_PRIMARY_MARKER_VALUE);

    // Simulate IndexedDB being deleted separately while the frozen legacy keys remain.
    await db.delete();
    await db.open();
    await expect(migrateLegacyLocalStorageToDexie({ db, storage })).rejects.toMatchObject({
      name: 'LegacyMigrationError',
      code: 'previously-initialized-database-missing',
    });
    expect(await db.transactions.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(storage.getItem(STORAGE_KEYS.transactions)).toBe(source.values[STORAGE_KEYS.transactions]);
  });

  it('does not repeat the migration or overwrite later Dexie changes', async () => {
    const source = completeLegacyStorage();
    const storage = new MemoryStorage(source.values);
    await migrateLegacyLocalStorageToDexie({ db, storage });

    await db.transactions.add({
      id: 9999,
      title: 'Поздняя операция',
      categoryId: 'def-1',
      category: 'Продукты',
      categoryIconName: 'ShoppingCart',
      amount: 50,
      date: '26 окт',
      dateISO: '2026-10-26',
      accountId: MAIN_ACCOUNT_ID,
      isIncome: false,
    });
    const brokenLegacyStorage: LegacyStorageReader = {
      getItem: () => { throw new Error('legacy storage should not be read after migration'); },
    };

    const result = await migrateLegacyLocalStorageToDexie({ db, storage: brokenLegacyStorage });
    expect(result.status).toBe('already-migrated');
    expect(await db.transactions.get(9999)).toMatchObject({ id: 9999, amount: 50 });
    expect(await db.transactions.count()).toBe(3);
  });

  it('rolls all writes back and does not create a marker when a table write fails', async () => {
    const source = completeLegacyStorage();
    const storage = new MemoryStorage(source.values);
    vi.spyOn(db.goals, 'bulkAdd').mockRejectedValueOnce(new Error('simulated disk error'));

    await expect(migrateLegacyLocalStorageToDexie({ db, storage })).rejects.toMatchObject({
      name: 'LegacyMigrationError',
      code: 'write-failed',
    });
    expect(await db.transactions.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect(await db.goals.count()).toBe(0);
    expect(await db.appState.count()).toBe(0);
    expect(await db.meta.get(LEGACY_MIGRATION_META_KEY)).toBeUndefined();
    expect(storage.values).toEqual(new Map(Object.entries(source.values)));
  });

  it('refuses to overwrite an unmarked database that already contains data', async () => {
    await db.accounts.put(createDefaultAccounts(800)[0]);
    const storage = new MemoryStorage(completeLegacyStorage().values);

    await expect(migrateLegacyLocalStorageToDexie({ db, storage })).rejects.toMatchObject({
      name: 'LegacyMigrationError',
      code: 'database-not-empty',
    });
    expect(await db.accounts.get(MAIN_ACCOUNT_ID)).toMatchObject({ initialBalance: 800 });
    expect(await db.meta.get(LEGACY_MIGRATION_META_KEY)).toBeUndefined();
  });

  it('refuses to overwrite a database with existing metadata but no migration marker', async () => {
    await db.meta.put({ key: 'unrelated-state', value: { source: 'test' } });
    const storage = new MemoryStorage(completeLegacyStorage().values);

    await expect(migrateLegacyLocalStorageToDexie({ db, storage })).rejects.toMatchObject({
      name: 'LegacyMigrationError',
      code: 'database-not-empty',
    });
    expect(await db.accounts.count()).toBe(0);
    expect(await db.meta.get(LEGACY_MIGRATION_META_KEY)).toBeUndefined();
  });
});
