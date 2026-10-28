import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createDefaultAccounts } from '@/data/accounts';
import { createDatabaseBackupFile } from '@/backup/backupService';
import type { Transaction } from '@/data/mockData';
import { neoFinanceDb } from '@/db/neoFinanceDb';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { DEXIE_PRIMARY_MARKER_KEY, DEXIE_PRIMARY_MARKER_VALUE, STORAGE_KEYS } from '@/storage/storageKeys';
import { useTransactions } from '@/hooks/useTransactions';
import {
  initializeDatabaseStorage,
  persistTransactions,
  queryDatabaseTransactions,
  readCurrentDatabaseSnapshot,
  restoreDatabaseSnapshot,
} from '@/storage/databaseStorage';

const categories = [
  { id: 'cat-first', name: 'Первое', iconName: 'ShoppingCart', isIncome: false, isArchived: false },
  { id: 'cat-second', name: 'Второе', iconName: 'Car', isIncome: false, isArchived: false },
];

const transactions: Transaction[] = [
  { id: 20, title: 'Первое', categoryId: 'cat-first', category: 'Первое', categoryIconName: 'ShoppingCart', amount: 200, date: '26 окт', dateISO: '2026-10-26', accountId: 'acc-main', isIncome: false },
  { id: 10, title: 'Второе', categoryId: 'cat-second', category: 'Второе', categoryIconName: 'Car', amount: 100, date: '25 окт', dateISO: '2026-10-25', accountId: 'acc-main', isIncome: false },
];

async function resetDatabase() {
  // Dexie.delete() closes this singleton with auto-open disabled. Reopen it
  // explicitly so the next migration test can use the same configured instance.
  await neoFinanceDb.delete();
  await neoFinanceDb.open();
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  window.localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(createDefaultAccounts(12_000)));
  window.localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  window.localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify([]));
  window.localStorage.setItem(STORAGE_KEYS.userName, 'Тестовый профиль');
  window.localStorage.setItem(STORAGE_KEYS.initialBalance, '12000');
  window.localStorage.setItem(STORAGE_KEYS.monthlyBudget, '30000');
  window.localStorage.setItem(STORAGE_KEYS.theme, 'dark');
  window.localStorage.setItem(STORAGE_KEYS.backgroundStyle, 'solid');
}

describe('database storage', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('migrates legacy data and preserves the original array order across IndexedDB reads', async () => {
    const snapshot = await initializeDatabaseStorage();
    expect(snapshot.transactions.map((transaction) => transaction.id)).toEqual([20, 10]);
    expect(snapshot.accounts.map((account) => account.id)).toEqual(['acc-main']);
    expect(snapshot.profile).toMatchObject({ userName: 'Тестовый профиль', initialBalance: 12_000, monthlyBudget: 30_000 });
    expect(snapshot.settings).toEqual({ themeMode: 'dark', backgroundStyle: 'solid' });

    await persistTransactions([...snapshot.transactions].reverse());
    const reloaded = await initializeDatabaseStorage();
    expect(reloaded.transactions.map((transaction) => transaction.id)).toEqual([10, 20]);
  });

  it('reads a fresh, transactionally consistent snapshot instead of stale bootstrap data', async () => {
    await initializeDatabaseStorage();

    await neoFinanceDb.transaction('rw', [neoFinanceDb.transactions, neoFinanceDb.accounts, neoFinanceDb.appState], async () => {
      await neoFinanceDb.transactions.update(20, { amount: 9_876 });
      await neoFinanceDb.accounts.update('acc-main', { initialBalance: 54_321 });
      await neoFinanceDb.appState.put({ key: 'profile', value: { userName: 'Актуальный профиль', monthlyBudget: 33_333 } });
      await neoFinanceDb.appState.put({ key: 'settings', value: { themeMode: 'dark', backgroundStyle: 'solid' } });
    });

    const snapshot = await readCurrentDatabaseSnapshot();
    expect(snapshot.transactions.map((transaction) => transaction.id)).toEqual([20, 10]);
    expect(snapshot.transactions[0].amount).toBe(9_876);
    expect(snapshot.accounts[0]).toMatchObject({ id: 'acc-main', initialBalance: 54_321 });
    expect(snapshot.profile).toEqual({ userName: 'Актуальный профиль', monthlyBudget: 33_333, initialBalance: 54_321 });
    expect(snapshot.settings).toEqual({ themeMode: 'dark', backgroundStyle: 'solid' });

    const backup = await createDatabaseBackupFile();
    expect(backup.data.transactions[0].amount).toBe(9_876);
    expect(backup.data.accounts[0].initialBalance).toBe(54_321);
    expect(backup.data.profile).toEqual({ userName: 'Актуальный профиль', monthlyBudget: 33_333, initialBalance: 54_321 });
    expect(backup.data.settings).toEqual({ themeMode: 'dark', backgroundStyle: 'solid' });
  });

  it('keeps the mounted transaction hook in sync with changes written directly to Dexie', async () => {
    await initializeDatabaseStorage();
    const { result } = renderHook(() => useTransactions(categories));

    await waitFor(() => {
      expect(result.current.transactions.map((transaction) => transaction.id)).toEqual([20, 10]);
    });

    await act(async () => {
      // Simulate a Dexie write that did not originate from this hook.
      await neoFinanceDb.transactions.update(20, { amount: 777 });
    });

    await waitFor(() => {
      expect(result.current.transactions.map((transaction) => transaction.amount)).toEqual([777, 100]);
    });
  });


  it('writes a local delta without deleting an unrelated row added by another tab', async () => {
    const snapshot = await initializeDatabaseStorage();
    const external: Transaction = {
      ...snapshot.transactions[0],
      id: 99,
      title: 'Из другой вкладки',
      category: 'Из другой вкладки',
      amount: 999,
    };
    const orderRecord = await neoFinanceDb.appState.get('collectionOrder');
    const previousOrder = orderRecord?.value as { transactions?: number[] } | undefined;

    await neoFinanceDb.transaction('rw', [neoFinanceDb.transactions, neoFinanceDb.appState], async () => {
      await neoFinanceDb.transactions.put(external);
      await neoFinanceDb.appState.put({
        key: 'collectionOrder',
        value: { ...(previousOrder ?? {}), transactions: [...(previousOrder?.transactions ?? []), external.id] },
      });
    });

    const next = snapshot.transactions.map((transaction) =>
      transaction.id === 20 ? { ...transaction, amount: 777 } : transaction,
    );
    await persistTransactions(next, snapshot.transactions);

    const reloaded = await queryDatabaseTransactions();
    expect(reloaded.map((transaction) => transaction.id)).toEqual([20, 10, 99]);
    expect(reloaded.find((transaction) => transaction.id === 20)?.amount).toBe(777);
    expect(reloaded.find((transaction) => transaction.id === 99)?.amount).toBe(999);
  });

  it('rejects a stale write to the same record instead of overwriting the latest database value', async () => {
    const snapshot = await initializeDatabaseStorage();
    await neoFinanceDb.transactions.update(20, { amount: 888 });

    const staleNext = snapshot.transactions.map((transaction) =>
      transaction.id === 20 ? { ...transaction, amount: 777 } : transaction,
    );

    await expect(persistTransactions(staleNext, snapshot.transactions)).rejects.toThrow('Concurrent change detected');
    expect((await neoFinanceDb.transactions.get(20))?.amount).toBe(888);
  });

  it('deletes only the requested transaction when another tab has added a separate row', async () => {
    const snapshot = await initializeDatabaseStorage();
    const external: Transaction = {
      ...snapshot.transactions[0],
      id: 99,
      title: 'Из другой вкладки',
      category: 'Из другой вкладки',
      amount: 999,
    };
    const orderRecord = await neoFinanceDb.appState.get('collectionOrder');
    const previousOrder = orderRecord?.value as { transactions?: number[] } | undefined;
    await neoFinanceDb.transaction('rw', [neoFinanceDb.transactions, neoFinanceDb.appState], async () => {
      await neoFinanceDb.transactions.put(external);
      await neoFinanceDb.appState.put({
        key: 'collectionOrder',
        value: { ...(previousOrder ?? {}), transactions: [...(previousOrder?.transactions ?? []), external.id] },
      });
    });

    await persistTransactions(snapshot.transactions.filter((transaction) => transaction.id !== 20), snapshot.transactions);

    const reloaded = await queryDatabaseTransactions();
    expect(reloaded.map((transaction) => transaction.id)).toEqual([10, 99]);
    expect(await neoFinanceDb.transactions.get(20)).toBeUndefined();
    expect(await neoFinanceDb.transactions.get(99)).toMatchObject({ amount: 999 });
  });

  it('marks a backup-restored empty database as initialized so stale LocalStorage cannot seed it later', async () => {
    // Simulate a new/empty database after an earlier Dexie database was removed.
    await neoFinanceDb.delete();
    await neoFinanceDb.open();
    await restoreDatabaseSnapshot({
      transactions: [],
      accounts: createDefaultAccounts(1_234),
      categories: DEFAULT_CATEGORIES,
      goals: [],
      profile: { userName: 'Восстановлено', initialBalance: 1_234, monthlyBudget: 44_000 },
      settings: { themeMode: 'dark', backgroundStyle: 'solid' },
    });

    const marker = await neoFinanceDb.meta.get('legacy-localstorage-v1');
    expect(marker?.value).toMatchObject({ status: 'completed', source: 'backup-restore', migrationVersion: 1 });
    const snapshot = await initializeDatabaseStorage();
    expect(snapshot.profile).toMatchObject({ userName: 'Восстановлено', initialBalance: 1_234, monthlyBudget: 44_000 });
    expect(snapshot.transactions).toEqual([]);
    expect(window.localStorage.getItem(DEXIE_PRIMARY_MARKER_KEY)).toBe(DEXIE_PRIMARY_MARKER_VALUE);
  });


  it('rejects a transaction that references a missing account without rewriting the stored row', async () => {
    await initializeDatabaseStorage();
    await neoFinanceDb.transactions.update(20, { accountId: 'acc-missing' });

    await expect(readCurrentDatabaseSnapshot()).rejects.toThrow(/операция №20.*счёт не существует/i);
    expect(await neoFinanceDb.transactions.get(20)).toMatchObject({ accountId: 'acc-missing' });
  });

  it('rejects a transaction whose income/expense type conflicts with its linked custom category', async () => {
    await initializeDatabaseStorage();
    await neoFinanceDb.transactions.update(20, { isIncome: true });

    await expect(readCurrentDatabaseSnapshot()).rejects.toThrow(/не соответствует типу связанной категории/i);
    expect(await neoFinanceDb.transactions.get(20)).toMatchObject({ isIncome: true });
  });

  it('preserves legacy unresolved transfers listed in the migration marker', async () => {
    const unresolvedTransfer: Transaction = {
      id: 1003,
      title: 'Перевод между счетами',
      categoryId: null,
      category: 'Перевод',
      categoryIconName: 'ArrowLeftRight',
      amount: 100,
      date: '26 окт',
      dateISO: '2026-10-26',
      accountId: 'acc-main',
      toAccountId: 'acc-legacy-missing',
      isIncome: false,
      isTransfer: true,
    };
    window.localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([unresolvedTransfer]));

    const snapshot = await initializeDatabaseStorage();

    expect(snapshot.transactions).toMatchObject([{ id: 1003, accountId: 'acc-main', toAccountId: 'acc-legacy-missing', isTransfer: true }]);
    expect(await neoFinanceDb.meta.get('legacy-localstorage-v1')).toMatchObject({
      value: { unresolvedTransferIds: [1003] },
    });
  });

  it('keeps legacy financial LocalStorage snapshots unchanged after Dexie becomes authoritative', async () => {
    const snapshot = await initializeDatabaseStorage();
    const legacyKeys = [STORAGE_KEYS.transactions, STORAGE_KEYS.accounts, STORAGE_KEYS.categories, STORAGE_KEYS.goals];
    const legacyValues = new Map(legacyKeys.map((key) => [key, window.localStorage.getItem(key)] as const));
    const { result } = renderHook(() => useTransactions(categories));

    act(() => {
      expect(result.current.addTransaction(
        { amount: 125, categoryId: 'cat-first', isIncome: false },
        snapshot.accounts,
      )).toBe(true);
    });

    await waitFor(async () => {
      expect(await queryDatabaseTransactions()).toHaveLength(3);
    });

    for (const key of legacyKeys) {
      expect(window.localStorage.getItem(key)).toBe(legacyValues.get(key));
    }
  });

  it('restores JSON backup records atomically while keeping the migration marker', async () => {
    await initializeDatabaseStorage();
    await restoreDatabaseSnapshot({
      transactions: [],
      accounts: createDefaultAccounts(-500),
      categories: DEFAULT_CATEGORIES,
      goals: [],
      profile: { userName: 'После восстановления', initialBalance: -500, monthlyBudget: 45_000 },
      settings: { themeMode: 'light', backgroundStyle: 'gradient' },
    });

    const snapshot = await initializeDatabaseStorage();
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.profile).toMatchObject({ userName: 'После восстановления', initialBalance: -500, monthlyBudget: 45_000 });
    expect(snapshot.settings).toEqual({ themeMode: 'light', backgroundStyle: 'gradient' });
    expect(await neoFinanceDb.meta.get('legacy-localstorage-v1')).toBeDefined();
  });
});
