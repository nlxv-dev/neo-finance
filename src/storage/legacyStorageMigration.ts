import { createDefaultAccounts, DEFAULT_ACCOUNT_CURRENCY, MAIN_ACCOUNT_ID, normalizeStoredAccounts, type Account } from '@/data/accounts';
import { DEFAULT_CATEGORIES, normalizeStoredCategories, type CustomCategory } from '@/data/categories';
import { normalizeStoredGoals, type Goal } from '@/data/goals';
import { initialTransactions, type Transaction } from '@/data/mockData';
import { normalizeStoredTransactions, reconcileTransactionAccountReferences } from '@/data/transactions';
import type { BackgroundStyle, ThemeMode } from '@/data/settings';
import { NeoFinanceDatabase, neoFinanceDb, type AppStateRecord, type LegacyMigrationMarker, type MigrationCounts, type ProfileState, type SettingsState } from '@/db/neoFinanceDb';
import { DEXIE_PRIMARY_MARKER_KEY, DEXIE_PRIMARY_MARKER_VALUE, LAST_BACKUP_KEY, RECOVERY_KEYS, STORAGE_KEYS } from '@/storage/storageKeys';

export const LEGACY_MIGRATION_META_KEY = 'legacy-localstorage-v1';
const DEFAULT_USER_NAME = 'Пользователь';
const DEFAULT_MONTHLY_BUDGET = 50_000;
const MAX_MONEY_AMOUNT = 1_000_000_000_000;

export interface LegacyStorageReader {
  getItem(key: string): string | null;
  /** Available for the browser's LocalStorage and writable migration-test doubles. */
  setItem?(key: string, value: string): void;
}

export interface LegacyMigrationDataset {
  transactions: Transaction[];
  accounts: Account[];
  categories: CustomCategory[];
  goals: Goal[];
  profile: ProfileState & { initialBalance: number };
  settings: SettingsState;
  lastBackupAt: string | null;
  source: 'localStorage' | 'new-install';
  unresolvedTransferIds: number[];
  sourceKeys: {
    present: string[];
    missing: string[];
  };
}

export interface LegacyMigrationOptions {
  db?: NeoFinanceDatabase;
  storage?: LegacyStorageReader;
  now?: () => Date;
}

export type LegacyMigrationResult =
  | { status: 'migrated'; counts: MigrationCounts; source: 'localStorage' | 'new-install' }
  | { status: 'already-migrated'; counts: MigrationCounts };

export class LegacyMigrationError extends Error {
  readonly key?: string;
  readonly code: 'storage-unavailable' | 'corrupt-data' | 'invalid-data' | 'database-not-empty' | 'previously-initialized-database-missing' | 'write-failed';

  constructor(message: string, code: LegacyMigrationError['code'], key?: string) {
    super(message);
    this.name = 'LegacyMigrationError';
    this.code = code;
    this.key = key;
  }
}

interface RawSnapshot {
  values: Map<string, string | null>;
  present: string[];
  missing: string[];
}

function isThemeMode(value: string): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isBackgroundStyle(value: string): value is BackgroundStyle {
  return value === 'gradient' || value === 'solid';
}

function getBrowserStorage(): LegacyStorageReader {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('LocalStorage is not available in this environment.');
    }
    return window.localStorage;
  } catch {
    throw new LegacyMigrationError(
      'Не удалось прочитать локальные данные браузера. Миграция остановлена; приложение не должно запускаться с пустыми данными.',
      'storage-unavailable',
    );
  }
}

/**
 * Records outside IndexedDB that Dexie has become the authoritative store.
 * This marker is best-effort: failure must not block a successfully migrated app,
 * but when it exists it prevents silently reviving stale, frozen LocalStorage data.
 */
export function markDexieAsPrimaryStorage(storage?: LegacyStorageReader): void {
  let destination = storage;
  if (!destination) {
    try {
      destination = getBrowserStorage();
    } catch {
      return;
    }
  }
  if (!destination.setItem) return;
  try {
    destination.setItem(DEXIE_PRIMARY_MARKER_KEY, DEXIE_PRIMARY_MARKER_VALUE);
  } catch {
    // IndexedDB remains authoritative; the app still works if this safety hint cannot be written.
  }
}

function readDexiePrimaryMarker(storage: LegacyStorageReader): string | null {
  try {
    return storage.getItem(DEXIE_PRIMARY_MARKER_KEY);
  } catch {
    throw new LegacyMigrationError(
      'Не удалось проверить маркер основного хранилища. Автоматическая миграция остановлена, чтобы не рисковать финансовыми данными.',
      'storage-unavailable',
      DEXIE_PRIMARY_MARKER_KEY,
    );
  }
}

function readSnapshot(storage: LegacyStorageReader): RawSnapshot {
  const keys = [...RECOVERY_KEYS, LAST_BACKUP_KEY];
  const values = new Map<string, string | null>();
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of keys) {
    try {
      const value = storage.getItem(key);
      values.set(key, value);
      if (value === null) missing.push(key);
      else present.push(key);
    } catch {
      throw new LegacyMigrationError(
        `Не удалось прочитать ключ «${key}». Исходные данные оставлены без изменений.`,
        'storage-unavailable',
        key,
      );
    }
  }

  return { values, present, missing };
}

function parseJson<T>(snapshot: RawSnapshot, key: string, normalize: (value: unknown) => T | null): T | undefined {
  const raw = snapshot.values.get(key);
  if (raw === null || raw === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new LegacyMigrationError(
      `Данные в «${key}» содержат повреждённый JSON. Миграция остановлена; исходный ключ сохранён.`,
      'corrupt-data',
      key,
    );
  }

  let normalized: T | null;
  try {
    normalized = normalize(parsed);
  } catch {
    normalized = null;
  }
  if (normalized === null) {
    throw new LegacyMigrationError(
      `Данные в «${key}» не прошли проверку структуры. Миграция остановлена; исходный ключ сохранён.`,
      'invalid-data',
      key,
    );
  }
  return normalized;
}

function readStoredNumber(
  snapshot: RawSnapshot,
  key: string,
  fallback: number,
  validate: (value: number) => boolean,
): number {
  const raw = snapshot.values.get(key);
  if (raw === null || raw === undefined) return fallback;

  const parsed = raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed) || !validate(parsed)) {
    throw new LegacyMigrationError(
      `Число в «${key}» повреждено или выходит за допустимые пределы. Миграция остановлена; исходный ключ сохранён.`,
      'invalid-data',
      key,
    );
  }
  return Math.round(parsed);
}

function readStoredString(snapshot: RawSnapshot, key: string, fallback: string): string {
  const raw = snapshot.values.get(key);
  return raw === null || raw === undefined ? fallback : raw;
}

function assertMainAccount(accounts: Account[], key: string): Account {
  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  if (!mainAccount || mainAccount.isArchived || mainAccount.currency !== DEFAULT_ACCOUNT_CURRENCY) {
    throw new LegacyMigrationError(
      `В «${key}» отсутствует активный основной счёт acc-main в RUB. Миграция остановлена, исходные данные не изменены.`,
      'invalid-data',
      key,
    );
  }
  return mainAccount;
}

/**
 * Reads and validates the complete legacy data set without writing to any storage.
 * Missing keys use current first-install defaults; present malformed financial data fails closed.
 */
export function buildLegacyMigrationDataset(storage?: LegacyStorageReader): LegacyMigrationDataset {
  const source = storage ?? getBrowserStorage();
  const snapshot = readSnapshot(source);
  const isNewInstall = RECOVERY_KEYS.every((key) => snapshot.values.get(key) === null);

  const userName = readStoredString(snapshot, STORAGE_KEYS.userName, DEFAULT_USER_NAME);
  const legacyInitialBalance = readStoredNumber(
    snapshot,
    STORAGE_KEYS.initialBalance,
    0,
    (value) => Math.abs(value) <= MAX_MONEY_AMOUNT,
  );
  const monthlyBudget = readStoredNumber(
    snapshot,
    STORAGE_KEYS.monthlyBudget,
    DEFAULT_MONTHLY_BUDGET,
    (value) => value > 0 && value <= MAX_MONEY_AMOUNT,
  );

  const categories = parseJson(snapshot, STORAGE_KEYS.categories, normalizeStoredCategories) ?? DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const rawTransactions = parseJson(snapshot, STORAGE_KEYS.transactions, (value) => normalizeStoredTransactions(value, categories)) ?? [...initialTransactions];

  const parsedAccounts = parseJson(snapshot, STORAGE_KEYS.accounts, normalizeStoredAccounts);
  const accounts = parsedAccounts ?? createDefaultAccounts(legacyInitialBalance);
  if (parsedAccounts) assertMainAccount(accounts, STORAGE_KEYS.accounts);
  const mainAccount = accounts.find((account) => account.id === MAIN_ACCOUNT_ID);
  if (!mainAccount) {
    throw new LegacyMigrationError('Не удалось подготовить основной счёт. Исходные данные сохранены.', 'invalid-data', STORAGE_KEYS.accounts);
  }

  const goals = parseJson(snapshot, STORAGE_KEYS.goals, normalizeStoredGoals) ?? [];
  const reconciled = reconcileTransactionAccountReferences(rawTransactions, accounts.map((account) => account.id));

  const storedTheme = snapshot.values.get(STORAGE_KEYS.theme);
  const storedBackground = snapshot.values.get(STORAGE_KEYS.backgroundStyle);
  const themeMode: ThemeMode = storedTheme && isThemeMode(storedTheme) ? storedTheme : 'light';
  const backgroundStyle: BackgroundStyle = storedBackground && isBackgroundStyle(storedBackground) ? storedBackground : 'gradient';
  const lastBackupAt = snapshot.values.get(LAST_BACKUP_KEY) ?? null;

  return {
    transactions: reconciled.transactions,
    accounts,
    categories,
    goals,
    profile: { userName, initialBalance: mainAccount.initialBalance, monthlyBudget },
    settings: { themeMode, backgroundStyle },
    lastBackupAt,
    source: isNewInstall ? 'new-install' : 'localStorage',
    unresolvedTransferIds: reconciled.unresolvedTransferIds,
    sourceKeys: { present: snapshot.present, missing: snapshot.missing },
  };
}

function countsFor(dataset: LegacyMigrationDataset): MigrationCounts {
  return {
    transactions: dataset.transactions.length,
    accounts: dataset.accounts.length,
    categories: dataset.categories.length,
    goals: dataset.goals.length,
  };
}

function assertDatasetRelationships(dataset: LegacyMigrationDataset): void {
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  const unresolvedTransferIds = new Set(dataset.unresolvedTransferIds);
  if (!accountIds.has(MAIN_ACCOUNT_ID)) {
    throw new LegacyMigrationError('Подготовленный набор данных не содержит основной счёт. Миграция остановлена.', 'invalid-data');
  }

  for (const transaction of dataset.transactions) {
    const sourceAccountId = transaction.accountId?.trim();
    if (!transaction.isTransfer) {
      if (!sourceAccountId || !accountIds.has(sourceAccountId)) {
        throw new LegacyMigrationError(`Операция №${transaction.id} ссылается на неизвестный счёт. Миграция остановлена.`, 'invalid-data', STORAGE_KEYS.transactions);
      }
      continue;
    }

    const destinationAccountId = transaction.toAccountId?.trim();
    if (unresolvedTransferIds.has(transaction.id)) continue;
    if (
      !sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId ||
      !accountIds.has(sourceAccountId) || !accountIds.has(destinationAccountId) || transaction.isIncome
    ) {
      throw new LegacyMigrationError(`Перевод №${transaction.id} не прошёл проверку связей счетов. Миграция остановлена.`, 'invalid-data', STORAGE_KEYS.transactions);
    }
  }
}

function transactionMatches(expected: Transaction, actual: Transaction | undefined): boolean {
  if (!actual) return false;
  return expected.id === actual.id &&
    expected.title === actual.title &&
    expected.categoryId === actual.categoryId &&
    expected.category === actual.category &&
    expected.categoryIconName === actual.categoryIconName &&
    expected.amount === actual.amount &&
    expected.date === actual.date &&
    expected.dateISO === actual.dateISO &&
    expected.accountId === actual.accountId &&
    expected.isIncome === actual.isIncome &&
    expected.isTransfer === actual.isTransfer &&
    expected.toAccountId === actual.toAccountId;
}

function hasData(counts: MigrationCounts, appStateCount: number, metaCount: number): boolean {
  return counts.transactions > 0 || counts.accounts > 0 || counts.categories > 0 || counts.goals > 0 || appStateCount > 0 || metaCount > 0;
}

function getMarkerCounts(value: unknown): MigrationCounts | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<LegacyMigrationMarker>;
  const counts = candidate.counts;
  if (!counts || typeof counts !== 'object') return null;
  if (![counts.transactions, counts.accounts, counts.categories, counts.goals].every((count) => Number.isSafeInteger(count) && count >= 0)) return null;
  return counts;
}

/**
 * One-time, idempotent LocalStorage -> Dexie migration.
 * Legacy financial values are deliberately never modified or removed. A separate
 * authority marker is added after successful migration to detect stale snapshots.
 * All data-table writes and the IndexedDB success marker share one transaction.
 */
export async function migrateLegacyLocalStorageToDexie(options: LegacyMigrationOptions = {}): Promise<LegacyMigrationResult> {
  const db = options.db ?? neoFinanceDb;

  // Fast path: do not require old LocalStorage to remain readable after migration.
  const earlyMarker = await db.meta.get(LEGACY_MIGRATION_META_KEY);
  if (earlyMarker) {
    const counts = getMarkerCounts(earlyMarker.value);
    if (!counts || (earlyMarker.value as Partial<LegacyMigrationMarker>).status !== 'completed') {
      throw new LegacyMigrationError('Маркер миграции в базе повреждён. Нужна проверка данных; повторная миграция запрещена.', 'invalid-data');
    }
    // Backfill the external fence for users upgrading from an earlier Dexie stage.
    markDexieAsPrimaryStorage(options.storage);
    return { status: 'already-migrated', counts };
  }

  // The legacy keys deliberately remain as an emergency snapshot and are no longer
  // updated by the running app. If the Dexie marker vanished but this fence remains,
  // importing those keys automatically could roll the user back to stale transactions.
  const storage = options.storage ?? getBrowserStorage();
  const externalMarker = readDexiePrimaryMarker(storage);
  if (externalMarker !== null) {
    if (externalMarker !== DEXIE_PRIMARY_MARKER_VALUE) {
      throw new LegacyMigrationError(
        'Маркер основного хранилища повреждён. Автоматический импорт старых данных остановлен; восстановите последнюю JSON-копию.',
        'invalid-data',
        DEXIE_PRIMARY_MARKER_KEY,
      );
    }
    throw new LegacyMigrationError(
      'Neo Finance ранее уже использовал Dexie как основное хранилище, но маркер базы IndexedDB не найден. Старые значения LocalStorage могут быть устаревшими, поэтому они не импортированы автоматически. Восстановите данные из последней JSON-копии ниже.',
      'previously-initialized-database-missing',
      DEXIE_PRIMARY_MARKER_KEY,
    );
  }

  // Parse and normalize outside the IndexedDB transaction: no external storage API is awaited inside it.
  const dataset = buildLegacyMigrationDataset(storage);
  assertDatasetRelationships(dataset);
  const counts = countsFor(dataset);
  const now = options.now ?? (() => new Date());
  const marker: LegacyMigrationMarker = {
    key: LEGACY_MIGRATION_META_KEY,
    status: 'completed',
    migrationVersion: 1,
    completedAt: now().toISOString(),
    source: dataset.source,
    counts,
    unresolvedTransferIds: dataset.unresolvedTransferIds,
  };
  const appStateRecords: AppStateRecord[] = [
    { key: 'profile', value: { userName: dataset.profile.userName, monthlyBudget: dataset.profile.monthlyBudget } },
    { key: 'settings', value: dataset.settings },
    { key: 'lastBackupAt', value: dataset.lastBackupAt },
    // Dexie sorts by primary key; persist array order explicitly so lists and backups
    // preserve the order users had in the legacy LocalStorage representation.
    { key: 'collectionOrder', value: {
      transactions: dataset.transactions.map((row) => row.id),
      accounts: dataset.accounts.map((row) => row.id),
      categories: dataset.categories.map((row) => row.id),
      goals: dataset.goals.map((row) => row.id),
    } },
  ];

  let alreadyMigrated = false;
  await db.transaction(
    'rw',
    [db.transactions, db.accounts, db.categories, db.goals, db.appState, db.meta],
    async () => {
      // Re-check in the transaction to make concurrent start-up attempts safe.
      const existingMarker = await db.meta.get(LEGACY_MIGRATION_META_KEY);
      if (existingMarker) {
        const markerCounts = getMarkerCounts(existingMarker.value);
        if (!markerCounts || (existingMarker.value as Partial<LegacyMigrationMarker>).status !== 'completed') {
          throw new LegacyMigrationError('Маркер миграции в базе повреждён. Нужна проверка данных; повторная миграция запрещена.', 'invalid-data');
        }
        alreadyMigrated = true;
        return;
      }

      const [transactionCount, accountCount, categoryCount, goalCount, appStateCount, metaCount] = await Promise.all([
        db.transactions.count(),
        db.accounts.count(),
        db.categories.count(),
        db.goals.count(),
        db.appState.count(),
        db.meta.count(),
      ]);
      const existingCounts: MigrationCounts = {
        transactions: transactionCount,
        accounts: accountCount,
        categories: categoryCount,
        goals: goalCount,
      };
      if (hasData(existingCounts, appStateCount, metaCount)) {
        throw new LegacyMigrationError(
          'В базе Dexie уже есть данные, но нет маркера миграции. Автоматическая перезапись запрещена.',
          'database-not-empty',
        );
      }

      const writes: Promise<unknown>[] = [];
      if (dataset.transactions.length) writes.push(db.transactions.bulkAdd(dataset.transactions));
      if (dataset.accounts.length) writes.push(db.accounts.bulkAdd(dataset.accounts));
      if (dataset.categories.length) writes.push(db.categories.bulkAdd(dataset.categories));
      if (dataset.goals.length) writes.push(db.goals.bulkAdd(dataset.goals));
      writes.push(db.appState.bulkAdd(appStateRecords));
      await Promise.all(writes);

      // Verify persisted row counts before writing the success marker.
      const [savedTransactions, savedAccounts, savedCategories, savedGoals] = await Promise.all([
        db.transactions.count(),
        db.accounts.count(),
        db.categories.count(),
        db.goals.count(),
      ]);
      const savedCounts = {
        transactions: savedTransactions,
        accounts: savedAccounts,
        categories: savedCategories,
        goals: savedGoals,
      };
      if (JSON.stringify(savedCounts) !== JSON.stringify(counts)) {
        throw new LegacyMigrationError('Проверка количества записей после миграции не прошла. Транзакция будет отменена.', 'write-failed');
      }

      const savedMainAccount = await db.accounts.get(MAIN_ACCOUNT_ID);
      if (!savedMainAccount || savedMainAccount.initialBalance !== dataset.profile.initialBalance) {
        throw new LegacyMigrationError('Проверка основного счёта после миграции не прошла. Транзакция будет отменена.', 'write-failed');
      }

      const transactionSamples = dataset.transactions.length === 0
        ? []
        : [dataset.transactions[0], ...(dataset.transactions.length > 1 ? [dataset.transactions[dataset.transactions.length - 1]] : [])];
      for (const expected of transactionSamples) {
        const actual = await db.transactions.get(expected.id);
        if (!transactionMatches(expected, actual)) {
          throw new LegacyMigrationError(`Проверка операции №${expected.id} после миграции не прошла. Транзакция будет отменена.`, 'write-failed', STORAGE_KEYS.transactions);
        }
      }

      await db.meta.add({ key: LEGACY_MIGRATION_META_KEY, value: marker });
    },
  ).catch((error: unknown) => {
    if (error instanceof LegacyMigrationError) throw error;
    throw new LegacyMigrationError(
      'Не удалось сохранить данные в Dexie. Изменения базы отменены; исходный LocalStorage не изменён.',
      'write-failed',
    );
  });

  if (alreadyMigrated) {
    const markerRecord = await db.meta.get(LEGACY_MIGRATION_META_KEY);
    const existingCounts = markerRecord ? getMarkerCounts(markerRecord.value) : null;
    if (!existingCounts) {
      throw new LegacyMigrationError('Маркер миграции в базе повреждён. Нужна проверка данных.', 'invalid-data');
    }
    markDexieAsPrimaryStorage(options.storage);
    return { status: 'already-migrated', counts: existingCounts };
  }

  markDexieAsPrimaryStorage(options.storage);
  return { status: 'migrated', counts, source: dataset.source };
}
