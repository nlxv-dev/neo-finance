import type { Account } from '@/data/accounts';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import type { CustomCategory } from '@/data/categories';
import type { Goal } from '@/data/goals';
import type { Transaction } from '@/data/mockData';
import type { Table } from 'dexie';
import type { BackgroundStyle, ThemeMode } from '@/data/settings';
import type { LegacyMigrationMarker } from '@/db/neoFinanceDb';
import { assertDatabaseIntegrity } from '@/storage/databaseIntegrity';
import { neoFinanceDb, type ProfileState, type SettingsState } from '@/db/neoFinanceDb';
import { LEGACY_MIGRATION_META_KEY, markDexieAsPrimaryStorage, migrateLegacyLocalStorageToDexie } from '@/storage/legacyStorageMigration';
import { areRecordArraysEqual } from '@/storage/recordEquality';

export interface CollectionOrder {
  transactions: number[];
  accounts: string[];
  categories: string[];
  goals: string[];
}

export interface DatabaseBootstrapSnapshot {
  transactions: Transaction[];
  accounts: Account[];
  categories: CustomCategory[];
  goals: Goal[];
  profile: ProfileState & { initialBalance: number };
  settings: SettingsState;
  lastBackupAt: string | null;
}

const COLLECTION_ORDER_KEY = 'collectionOrder';
const PROFILE_KEY = 'profile';
const SETTINGS_KEY = 'settings';
const LAST_BACKUP_KEY = 'lastBackupAt';
let bootstrapSnapshot: DatabaseBootstrapSnapshot | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isBackgroundStyle(value: unknown): value is BackgroundStyle {
  return value === 'gradient' || value === 'solid';
}

function ordered<T, K extends string | number>(rows: T[], ids: K[] | undefined, getId: (row: T) => K): T[] {
  if (!Array.isArray(ids)) return rows;
  const byId = new Map<K, T>(rows.map((row) => [getId(row), row] as const));
  const result: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row !== undefined) {
      result.push(row);
      byId.delete(id);
    }
  }
  result.push(...byId.values());
  return result;
}

/**
 * Reads every durable table and its order metadata inside one readonly IndexedDB
 * transaction. Callers therefore receive one consistent point-in-time snapshot,
 * not a mixture of rows read before and after another tab's write.
 */
async function readConsistentDatabaseSnapshot(): Promise<DatabaseBootstrapSnapshot> {
  return neoFinanceDb.transaction('r', [
    neoFinanceDb.transactions,
    neoFinanceDb.accounts,
    neoFinanceDb.categories,
    neoFinanceDb.goals,
    neoFinanceDb.appState,
    neoFinanceDb.meta,
  ], async () => {
    const [transactions, accounts, categories, goals, stateRecords, metaRecords] = await Promise.all([
      neoFinanceDb.transactions.toArray(),
      neoFinanceDb.accounts.toArray(),
      neoFinanceDb.categories.toArray(),
      neoFinanceDb.goals.toArray(),
      neoFinanceDb.appState.toArray(),
      neoFinanceDb.meta.toArray(),
    ]);
    const state = new Map(stateRecords.map((record) => [record.key, record.value] as const));
    const meta = new Map(metaRecords.map((record) => [record.key, record.value] as const));
    const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
    const rawProfile = state.get(PROFILE_KEY);
    const rawSettings = state.get(SETTINGS_KEY);

    if (!mainAccount || !isRecord(rawProfile) || !isRecord(rawSettings)) {
      throw new Error('База Neo Finance открылась, но в ней отсутствуют обязательные записи. Исходный LocalStorage не удалён; требуется безопасное восстановление.');
    }

    const name = rawProfile.userName;
    const budget = rawProfile.monthlyBudget;
    const themeMode = rawSettings.themeMode;
    const backgroundStyle = rawSettings.backgroundStyle;
    if (typeof name !== 'string' || typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0 || !isThemeMode(themeMode) || !isBackgroundStyle(backgroundStyle)) {
      throw new Error('Настройки базы Neo Finance не прошли проверку. Исходный LocalStorage не удалён; требуется безопасное восстановление.');
    }

    const migrationMarkerValue = meta.get(LEGACY_MIGRATION_META_KEY);
    const migrationMarker = isRecord(migrationMarkerValue) ? migrationMarkerValue as unknown as LegacyMigrationMarker : null;
    const unresolvedTransferIds = Array.isArray(migrationMarker?.unresolvedTransferIds)
      ? migrationMarker.unresolvedTransferIds.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id))
      : [];

    assertDatabaseIntegrity({ transactions, accounts, categories, goals, unresolvedTransferIds });

    const rawOrder = state.get(COLLECTION_ORDER_KEY);
    const order = isRecord(rawOrder) ? rawOrder as unknown as Partial<CollectionOrder> : {};
    return {
      transactions: ordered(transactions, order.transactions, (row) => row.id),
      accounts: ordered(accounts, order.accounts, (row) => row.id),
      categories: ordered(categories, order.categories, (row) => row.id),
      goals: ordered(goals, order.goals, (row) => row.id),
      profile: { userName: name, monthlyBudget: budget, initialBalance: mainAccount.initialBalance },
      settings: { themeMode, backgroundStyle },
      lastBackupAt: typeof state.get(LAST_BACKUP_KEY) === 'string' ? state.get(LAST_BACKUP_KEY) as string : null,
    };
  });
}

/** Loads the database before React mounts. The legacy migration keeps its own atomic transaction. */
export async function initializeDatabaseStorage(): Promise<DatabaseBootstrapSnapshot> {
  await migrateLegacyLocalStorageToDexie();
  await neoFinanceDb.open();
  const snapshot = await readConsistentDatabaseSnapshot();
  bootstrapSnapshot = snapshot;
  return snapshot;
}

/** Returns a fresh, transactionally consistent snapshot for backup/export operations. */
export function readCurrentDatabaseSnapshot(): Promise<DatabaseBootstrapSnapshot> {
  return readConsistentDatabaseSnapshot();
}

export function getDatabaseBootstrapSnapshot(): DatabaseBootstrapSnapshot | null {
  return bootstrapSnapshot;
}

export function hasDatabaseBootstrap(): boolean {
  return bootstrapSnapshot !== null;
}

/** Reactive-query readers used by dexie-react-hooks. These read from IndexedDB,
 * including the collection-order metadata, instead of treating the startup
 * snapshot as the long-lived source of truth. */
async function readCollectionOrder(): Promise<Partial<CollectionOrder>> {
  const record = await neoFinanceDb.appState.get(COLLECTION_ORDER_KEY);
  return isRecord(record?.value) ? record.value as Partial<CollectionOrder> : {};
}

async function readOrderedCollection<T, K extends string | number>(
  table: Table<T, K>,
  collection: keyof CollectionOrder,
  getId: (row: T) => K,
): Promise<T[]> {
  return neoFinanceDb.transaction('r', table, neoFinanceDb.appState, async () => {
    const [rows, order] = await Promise.all([table.toArray(), readCollectionOrder()]);
    return ordered(rows, order[collection] as K[] | undefined, getId);
  });
}

export function queryDatabaseTransactions(): Promise<Transaction[]> {
  return readOrderedCollection(neoFinanceDb.transactions, 'transactions', (row) => row.id);
}

export function queryDatabaseAccounts(): Promise<Account[]> {
  return readOrderedCollection(neoFinanceDb.accounts, 'accounts', (row) => row.id);
}

export function queryDatabaseCategories(): Promise<CustomCategory[]> {
  return readOrderedCollection(neoFinanceDb.categories, 'categories', (row) => row.id);
}

export function queryDatabaseGoals(): Promise<Goal[]> {
  return readOrderedCollection(neoFinanceDb.goals, 'goals', (row) => row.id);
}

export interface LiveDatabaseProfile {
  userName: string;
  monthlyBudget: number;
  initialBalance: number;
}

export async function queryDatabaseProfile(): Promise<LiveDatabaseProfile | null> {
  return neoFinanceDb.transaction('r', neoFinanceDb.appState, neoFinanceDb.accounts, async () => {
    const [profileRecord, mainAccount] = await Promise.all([
      neoFinanceDb.appState.get(PROFILE_KEY),
      neoFinanceDb.accounts.get(MAIN_ACCOUNT_ID),
    ]);
    if (!isRecord(profileRecord?.value) || !mainAccount) return null;
    const { userName, monthlyBudget } = profileRecord.value;
    if (typeof userName !== 'string' || typeof monthlyBudget !== 'number' || !Number.isFinite(monthlyBudget)) return null;
    return { userName, monthlyBudget, initialBalance: mainAccount.initialBalance };
  });
}

export async function queryDatabaseSettings(): Promise<SettingsState | null> {
  const record = await neoFinanceDb.appState.get(SETTINGS_KEY);
  if (!isRecord(record?.value)) return null;
  const { themeMode, backgroundStyle } = record.value;
  if (!isThemeMode(themeMode) || !isBackgroundStyle(backgroundStyle)) return null;
  return { themeMode, backgroundStyle };
}

function mergeOrderRecord(current: unknown, collection: keyof CollectionOrder, ids: CollectionOrder[keyof CollectionOrder]): CollectionOrder {
  const raw = isRecord(current) ? current : {};
  return {
    transactions: Array.isArray(raw.transactions) ? raw.transactions as number[] : [],
    accounts: Array.isArray(raw.accounts) ? raw.accounts as string[] : [],
    categories: Array.isArray(raw.categories) ? raw.categories as string[] : [],
    goals: Array.isArray(raw.goals) ? raw.goals as string[] : [],
    [collection]: ids,
  } as CollectionOrder;
}

async function replaceTableRows<T, K extends string | number>(
  table: Table<T, K>,
  rows: T[],
  getId: (row: T) => K,
  collection: keyof CollectionOrder,
): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.transaction('rw', table, neoFinanceDb.appState, async () => {
      const oldIds = await table.toCollection().primaryKeys();
      const nextIds = new Set(rows.map(getId));
      const removedIds = oldIds.filter((id) => !nextIds.has(id));
      if (removedIds.length) await table.bulkDelete(removedIds);
      if (rows.length) await table.bulkPut(rows);
      const currentOrder = await neoFinanceDb.appState.get(COLLECTION_ORDER_KEY);
      await neoFinanceDb.appState.put({
        key: COLLECTION_ORDER_KEY,
        value: mergeOrderRecord(currentOrder?.value, collection, rows.map(getId) as unknown as CollectionOrder[keyof CollectionOrder]),
      });
    });

    // Keep the startup snapshot coherent if a hook is ever remounted in this session.
    if (bootstrapSnapshot) {
      switch (collection) {
        case 'transactions':
          bootstrapSnapshot = { ...bootstrapSnapshot, transactions: rows as Transaction[] };
          break;
        case 'accounts': {
          const nextAccounts = rows as Account[];
          const mainAccount = nextAccounts.find((account) => account.id === MAIN_ACCOUNT_ID);
          bootstrapSnapshot = {
            ...bootstrapSnapshot,
            accounts: nextAccounts,
            ...(mainAccount ? { profile: { ...bootstrapSnapshot.profile, initialBalance: mainAccount.initialBalance } } : {}),
          };
          break;
        }
        case 'categories':
          bootstrapSnapshot = { ...bootstrapSnapshot, categories: rows as CustomCategory[] };
          break;
        case 'goals':
          bootstrapSnapshot = { ...bootstrapSnapshot, goals: rows as Goal[] };
          break;
      }
    }
  });
}

/**
 * Applies only the changes between a hook's previous and next snapshot.
 * Untouched rows written by another tab are not deleted just because they
 * were absent from a stale React snapshot. Changed/deleted rows are guarded
 * against concurrent edits so that a stale row cannot silently overwrite a
 * newer value. Full replacement remains available for explicit restore/import
 * and for tests that intentionally reset collection order.
 */
async function persistCollectionChanges<T extends object, K extends string | number>(
  table: Table<T, K>,
  collection: keyof CollectionOrder,
  previousRows: T[],
  nextRows: T[],
  getId: (row: T) => K,
): Promise<void> {
  await enqueueWrite(async () => {
    const previousById = new Map(previousRows.map((row) => [getId(row), row] as const));
    const nextById = new Map(nextRows.map((row) => [getId(row), row] as const));
    const removedIds = [...previousById.keys()].filter((id) => !nextById.has(id));
    const changedRows = nextRows.filter((row) => {
      const previous = previousById.get(getId(row));
      return previous === undefined || !areRecordArraysEqual([previous], [row]);
    });
    const changedExistingIds = changedRows
      .map(getId)
      .filter((id) => previousById.has(id));
    const insertedIds = changedRows
      .map(getId)
      .filter((id) => !previousById.has(id));

    await neoFinanceDb.transaction('rw', table, neoFinanceDb.appState, async () => {
      // Validate all touched rows before writing anything. Dexie will roll back
      // this transaction if another tab has changed one of these same records.
      for (const id of changedExistingIds) {
        const stored = await table.get(id);
        const expected = previousById.get(id);
        if (!stored || !expected || !areRecordArraysEqual([stored], [expected])) {
          throw new Error(`Concurrent change detected in ${String(collection)} record ${String(id)}. The latest database value was preserved.`);
        }
      }
      for (const id of removedIds) {
        const stored = await table.get(id);
        const expected = previousById.get(id);
        if (stored && expected && !areRecordArraysEqual([stored], [expected])) {
          throw new Error(`Concurrent change detected while deleting ${String(collection)} record ${String(id)}. The latest database value was preserved.`);
        }
      }
      for (const id of insertedIds) {
        if (await table.get(id)) {
          throw new Error(`ID conflict while adding ${String(collection)} record ${String(id)}. The latest database value was preserved.`);
        }
      }

      if (removedIds.length) await table.bulkDelete(removedIds);
      if (changedRows.length) await table.bulkPut(changedRows);

      // Order metadata changes only when records are inserted or removed.
      // An amount/name edit should not invalidate other collection readers.
      if (removedIds.length > 0 || insertedIds.length > 0) {
        const currentOrderRecord = await neoFinanceDb.appState.get(COLLECTION_ORDER_KEY);
        const currentOrderValue = currentOrderRecord?.value;
        const currentOrder: Record<string, unknown> = isRecord(currentOrderValue) ? currentOrderValue : {};
        const rawIds = currentOrder[collection];
        const previousIds = previousRows.map(getId);
        const nextIds = nextRows.map(getId);
        const removedSet = new Set(removedIds);
        const previousSet = new Set(previousIds);
        const nextOrder: (string | number)[] = (Array.isArray(rawIds) ? rawIds : previousIds)
          .filter((id): id is string | number => (typeof id === 'string' || typeof id === 'number') && !removedSet.has(id as K));

        // Insert newly-added IDs beside the nearest surviving neighbor in the
        // intended order. Keep IDs introduced by another tab and their relative
        // order; `ordered()` appends valid records missing from old metadata.
        for (let index = 0; index < nextIds.length; index += 1) {
          const id = nextIds[index];
          if (previousSet.has(id) || nextOrder.includes(id)) continue;
          let insertAt = -1;
          for (let following = index + 1; following < nextIds.length; following += 1) {
            const candidate = nextOrder.indexOf(nextIds[following]);
            if (candidate >= 0) {
              insertAt = candidate;
              break;
            }
          }
          if (insertAt < 0) {
            for (let preceding = index - 1; preceding >= 0; preceding -= 1) {
              const candidate = nextOrder.indexOf(nextIds[preceding]);
              if (candidate >= 0) {
                insertAt = candidate + 1;
                break;
              }
            }
          }
          if (insertAt < 0) nextOrder.push(id);
          else nextOrder.splice(insertAt, 0, id);
        }

        await neoFinanceDb.appState.put({
          key: COLLECTION_ORDER_KEY,
          value: {
            ...currentOrder,
            [collection]: nextOrder,
          },
        });
      }
    });

    // Refresh the bootstrap fallback from the actual database state so an
    // external row preserved by the delta is not lost from the in-memory copy.
    if (bootstrapSnapshot) {
      const currentRows = await readOrderedCollection(table, collection, getId);
      switch (collection) {
        case 'transactions':
          bootstrapSnapshot = { ...bootstrapSnapshot, transactions: currentRows as Transaction[] };
          break;
        case 'accounts': {
          const accounts = currentRows as Account[];
          const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
          bootstrapSnapshot = {
            ...bootstrapSnapshot,
            accounts,
            ...(mainAccount ? { profile: { ...bootstrapSnapshot.profile, initialBalance: mainAccount.initialBalance } } : {}),
          };
          break;
        }
        case 'categories':
          bootstrapSnapshot = { ...bootstrapSnapshot, categories: currentRows as CustomCategory[] };
          break;
        case 'goals':
          bootstrapSnapshot = { ...bootstrapSnapshot, goals: currentRows as Goal[] };
          break;
      }
    }
  });
}

export function persistTransactions(rows: Transaction[], previousRows?: Transaction[]): Promise<void> {
  return previousRows
    ? persistCollectionChanges(neoFinanceDb.transactions, 'transactions', previousRows, rows, (row) => row.id)
    : replaceTableRows(neoFinanceDb.transactions, rows, (row) => row.id, 'transactions');
}

export function persistAccounts(rows: Account[], previousRows?: Account[]): Promise<void> {
  return previousRows
    ? persistCollectionChanges(neoFinanceDb.accounts, 'accounts', previousRows, rows, (row) => row.id)
    : replaceTableRows(neoFinanceDb.accounts, rows, (row) => row.id, 'accounts');
}

export function persistCategories(rows: CustomCategory[], previousRows?: CustomCategory[]): Promise<void> {
  return previousRows
    ? persistCollectionChanges(neoFinanceDb.categories, 'categories', previousRows, rows, (row) => row.id)
    : replaceTableRows(neoFinanceDb.categories, rows, (row) => row.id, 'categories');
}

export function persistGoals(rows: Goal[], previousRows?: Goal[]): Promise<void> {
  return previousRows
    ? persistCollectionChanges(neoFinanceDb.goals, 'goals', previousRows, rows, (row) => row.id)
    : replaceTableRows(neoFinanceDb.goals, rows, (row) => row.id, 'goals');
}

export async function persistProfile(profile: { userName: string; monthlyBudget: number }): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.appState.put({ key: PROFILE_KEY, value: profile });
    if (bootstrapSnapshot) {
      bootstrapSnapshot = { ...bootstrapSnapshot, profile: { ...bootstrapSnapshot.profile, ...profile } };
    }
  });
}

export async function persistSettings(settings: SettingsState): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.appState.put({ key: SETTINGS_KEY, value: settings });
    if (bootstrapSnapshot) bootstrapSnapshot = { ...bootstrapSnapshot, settings };
  });
}

export async function persistLastBackupAt(value: string): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.appState.put({ key: LAST_BACKUP_KEY, value });
    if (bootstrapSnapshot) bootstrapSnapshot = { ...bootstrapSnapshot, lastBackupAt: value };
  });
}

/** Replace imported JSON data as one all-or-nothing transaction. */
export async function restoreDatabaseSnapshot(data: {
  transactions: Transaction[];
  accounts: Account[];
  categories: CustomCategory[];
  goals: Goal[];
  profile: { userName: string; initialBalance: number; monthlyBudget: number };
  settings: SettingsState;
}): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.transaction('rw', [
      neoFinanceDb.transactions,
      neoFinanceDb.accounts,
      neoFinanceDb.categories,
      neoFinanceDb.goals,
      neoFinanceDb.appState,
      neoFinanceDb.meta,
    ], async () => {
      await Promise.all([
        neoFinanceDb.transactions.clear(),
        neoFinanceDb.accounts.clear(),
        neoFinanceDb.categories.clear(),
        neoFinanceDb.goals.clear(),
      ]);
      const writes: Promise<unknown>[] = [];
      if (data.transactions.length) writes.push(neoFinanceDb.transactions.bulkPut(data.transactions));
      if (data.accounts.length) writes.push(neoFinanceDb.accounts.bulkPut(data.accounts));
      if (data.categories.length) writes.push(neoFinanceDb.categories.bulkPut(data.categories));
      if (data.goals.length) writes.push(neoFinanceDb.goals.bulkPut(data.goals));
      writes.push(neoFinanceDb.appState.put({ key: PROFILE_KEY, value: { userName: data.profile.userName, monthlyBudget: data.profile.monthlyBudget } }));
      writes.push(neoFinanceDb.appState.put({ key: SETTINGS_KEY, value: data.settings }));
      writes.push(neoFinanceDb.appState.put({ key: COLLECTION_ORDER_KEY, value: {
        transactions: data.transactions.map((row) => row.id),
        accounts: data.accounts.map((row) => row.id),
        categories: data.categories.map((row) => row.id),
        goals: data.goals.map((row) => row.id),
      } satisfies CollectionOrder }));
      await Promise.all(writes);

      // A backup can be the first successful initialization after IndexedDB loss.
      // Replace the migration fence in this same transaction so startup won't try
      // to import stale legacy keys on the next launch.
      await neoFinanceDb.meta.put({
        key: LEGACY_MIGRATION_META_KEY,
        value: {
          key: LEGACY_MIGRATION_META_KEY,
          status: 'completed',
          migrationVersion: 1,
          completedAt: new Date().toISOString(),
          source: 'backup-restore',
          counts: {
            transactions: data.transactions.length,
            accounts: data.accounts.length,
            categories: data.categories.length,
            goals: data.goals.length,
          },
          unresolvedTransferIds: [],
        },
      });
    });
    markDexieAsPrimaryStorage();

    if (bootstrapSnapshot) {
      const mainAccount = data.accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
      bootstrapSnapshot = {
        ...bootstrapSnapshot,
        transactions: data.transactions,
        accounts: data.accounts,
        categories: data.categories,
        goals: data.goals,
        profile: {
          userName: data.profile.userName,
          monthlyBudget: data.profile.monthlyBudget,
          initialBalance: mainAccount?.initialBalance ?? data.profile.initialBalance,
        },
        settings: data.settings,
      };
    }
  });
}

/** Atomically writes the result of a CSV import while retaining account and goal records. */
export async function persistCsvImport(transactions: Transaction[], categories: CustomCategory[]): Promise<void> {
  await enqueueWrite(async () => {
    await neoFinanceDb.transaction('rw', [neoFinanceDb.transactions, neoFinanceDb.categories, neoFinanceDb.appState], async () => {
      const oldIds = await neoFinanceDb.transactions.toCollection().primaryKeys();
      const nextIds = new Set(transactions.map((row) => row.id));
      const removedIds = oldIds.filter((id) => !nextIds.has(id));
      if (removedIds.length) await neoFinanceDb.transactions.bulkDelete(removedIds);
      if (transactions.length) await neoFinanceDb.transactions.bulkPut(transactions);
      await neoFinanceDb.categories.clear();
      if (categories.length) await neoFinanceDb.categories.bulkPut(categories);
      const currentOrder = await neoFinanceDb.appState.get(COLLECTION_ORDER_KEY);
      const previousOrder = isRecord(currentOrder?.value) ? currentOrder?.value as unknown as CollectionOrder : { transactions: [], accounts: [], categories: [], goals: [] };
      await neoFinanceDb.appState.put({ key: COLLECTION_ORDER_KEY, value: {
        ...previousOrder,
        transactions: transactions.map((row) => row.id),
        categories: categories.map((row) => row.id),
      } });
    });

    if (bootstrapSnapshot) {
      bootstrapSnapshot = { ...bootstrapSnapshot, transactions, categories };
    }
  });
}

