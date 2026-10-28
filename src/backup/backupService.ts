import type { Transaction } from '@/data/mockData';
import { createDefaultAccounts, MAIN_ACCOUNT_ID, normalizeStoredAccounts, type Account } from '@/data/accounts';
import type { CustomCategory } from '@/data/categories';
import { LAST_BACKUP_KEY, STORAGE_KEYS } from '@/storage/storageKeys';
export { LAST_BACKUP_KEY, STORAGE_KEYS } from '@/storage/storageKeys';
import type { BackgroundStyle, ThemeMode } from '@/data/settings';
import { normalizeStoredGoals, type Goal } from '@/data/goals';
import { getTransactionRuleError, MAX_TRANSACTION_AMOUNT } from '@/data/transactionRules';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistCsvImport, persistLastBackupAt, queryDatabaseTransactions, readCurrentDatabaseSnapshot, restoreDatabaseSnapshot } from '@/storage/databaseStorage';

export const BACKUP_FORMAT = 'neo-finance-backup';
export const BACKUP_SCHEMA_VERSION = 4;

export interface BackupData {
  accounts: Account[];
  goals: Goal[];
  transactions: Transaction[];
  categories: CustomCategory[];
  profile: {
    userName: string;
    initialBalance: number;
    monthlyBudget: number;
  };
  settings: {
    themeMode: ThemeMode;
    backgroundStyle: BackgroundStyle;
  };
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  app: 'Neo Finance';
  exportedAt: string;
  data: BackupData;
}

export type CsvImportMode = 'replace' | 'append';

const CSV_HEADERS_V1 = ['id', 'amount', 'type', 'categoryId', 'category', 'categoryIconName', 'date', 'dateISO'];
const CSV_HEADERS_V2 = [...CSV_HEADERS_V1, 'accountId', 'toAccountId'];
const MAX_IMPORT_TRANSACTIONS = 50_000;
const MAX_IMPORT_CATEGORIES = 500;
const MAX_IMPORT_ACCOUNTS = 100;
const MAX_IMPORT_GOALS = 500;
const MAX_CSV_CHARACTERS = 50 * 1024 * 1024;

export interface ParsedTransactionsCsv {
  /** Version 1 is the original eight-column CSV; version 2 includes account and transfer fields. */
  schemaVersion: 1 | 2;
  transactions: Transaction[];
}
const SAFE_THEME_MODES = new Set<ThemeMode>(['system', 'light', 'dark']);
const SAFE_BACKGROUND_STYLES = new Set<BackgroundStyle>(['gradient', 'solid']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function requireString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new Error(`Поле «${label}» отсутствует или имеет неверный формат.`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, label: string, options?: { positive?: boolean; nonNegative?: boolean }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Поле «${label}» должно быть числом.`);
  }
  if (options?.positive && value <= 0) throw new Error(`Поле «${label}» должно быть больше нуля.`);
  if (options?.nonNegative && value < 0) throw new Error(`Поле «${label}» не может быть отрицательным.`);
  return value;
}

function normalizeCategories(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) throw new Error('В резервной копии отсутствует список категорий.');
  if (value.length > MAX_IMPORT_CATEGORIES) throw new Error(`Слишком много категорий. Максимум — ${MAX_IMPORT_CATEGORIES}.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Категория №${index + 1} имеет неверный формат.`);
    const id = requireString(entry.id, `id категории №${index + 1}`);
    if (entry.isArchived !== undefined && typeof entry.isArchived !== 'boolean') {
      throw new Error(`Статус архива категории №${index + 1} указан неверно.`);
    }
    if (ids.has(id)) throw new Error(`В резервной копии повторяется ID категории «${id}».`);
    ids.add(id);
    const name = requireString(entry.name, `название категории №${index + 1}`);
    const iconName = requireString(entry.iconName, `иконка категории №${index + 1}`);
    if (id.length > 128 || name.length > 80 || iconName.length > 100) {
      throw new Error(`Категория №${index + 1} превышает допустимую длину полей.`);
    }
    return {
      id,
      name,
      iconName,
      isIncome: typeof entry.isIncome === 'boolean' ? entry.isIncome : (() => { throw new Error(`Тип категории №${index + 1} указан неверно.`); })(),
      isArchived: entry.isArchived === true,
    };
  });
}

function normalizeTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) throw new Error('В резервной копии отсутствует история транзакций.');
  if (value.length > MAX_IMPORT_TRANSACTIONS) throw new Error(`Слишком много транзакций. Максимум — ${MAX_IMPORT_TRANSACTIONS}.`);
  const ids = new Set<number>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Транзакция №${index + 1} имеет неверный формат.`);
    const id = requireFiniteNumber(entry.id, `ID транзакции №${index + 1}`, { nonNegative: true });
    if (!Number.isSafeInteger(id)) throw new Error(`ID транзакции №${index + 1} должен быть целым числом.`);
    if (ids.has(id)) throw new Error(`В резервной копии повторяется ID транзакции ${id}.`);
    ids.add(id);
    const amount = requireFiniteNumber(entry.amount, `сумма транзакции №${index + 1}`, { positive: true });
    if (!Number.isSafeInteger(amount) || amount > MAX_TRANSACTION_AMOUNT) throw new Error(`Сумма транзакции №${index + 1} должна быть целым числом рублей не более 1 000 000 000 000.`);
    if (typeof entry.isIncome !== 'boolean') throw new Error(`Тип транзакции №${index + 1} указан неверно.`);
    const categoryId = entry.categoryId === null ? null : requireString(entry.categoryId, `categoryId транзакции №${index + 1}`, true) || null;
    const category = requireString(entry.category, `категория транзакции №${index + 1}`, true);
    if (entry.title !== undefined && typeof entry.title !== 'string') {
      throw new Error(`Заголовок транзакции №${index + 1} указан неверно.`);
    }
    if (entry.categoryIconName !== undefined && typeof entry.categoryIconName !== 'string') {
      throw new Error(`Иконка транзакции №${index + 1} указана неверно.`);
    }
    if (entry.dateISO !== undefined && entry.dateISO !== null && typeof entry.dateISO !== 'string') {
      throw new Error(`ISO-дата транзакции №${index + 1} указана неверно.`);
    }
    const title = typeof entry.title === 'string' ? entry.title : category;
    const categoryIconName = typeof entry.categoryIconName === 'string' && entry.categoryIconName
      ? entry.categoryIconName
      : 'HelpCircle';
    const date = requireString(entry.date, `дата транзакции №${index + 1}`, true);
    if (category.length > 160 || title.length > 160 || categoryIconName.length > 100 || date.length > 80 ||
      (typeof entry.categoryId === 'string' && entry.categoryId.length > 128) ||
      (typeof entry.dateISO === 'string' && entry.dateISO.length > 10)) {
      throw new Error(`Транзакция №${index + 1} превышает допустимую длину текстовых полей.`);
    }
    const dateISO = typeof entry.dateISO === 'string' && entry.dateISO ? entry.dateISO : undefined;
    if (entry.accountId !== undefined && entry.accountId !== null && typeof entry.accountId !== 'string') {
      throw new Error(`Счёт транзакции №${index + 1} указан неверно.`);
    }
    if (entry.isTransfer !== undefined && typeof entry.isTransfer !== 'boolean') {
      throw new Error(`Тип перевода транзакции №${index + 1} указан неверно.`);
    }
    if (entry.toAccountId !== undefined && entry.toAccountId !== null && typeof entry.toAccountId !== 'string') {
      throw new Error(`Счёт назначения транзакции №${index + 1} указан неверно.`);
    }
    const accountId = typeof entry.accountId === 'string' && entry.accountId.trim()
      ? entry.accountId.trim()
      : MAIN_ACCOUNT_ID;
    const isTransfer = entry.isTransfer === true;
    const toAccountId = typeof entry.toAccountId === 'string' ? entry.toAccountId.trim() : '';
    if (accountId.length > 128 || toAccountId.length > 128) throw new Error(`Счёт транзакции №${index + 1} имеет недопустимый идентификатор.`);
    if (isTransfer && (!toAccountId || toAccountId === accountId || amount <= 0)) {
      throw new Error(`Перевод №${id} должен указывать два разных счёта.`);
    }
    if (isTransfer && entry.isIncome === true) {
      throw new Error(`Перевод №${id} не может одновременно считаться доходом.`);
    }
    return {
      id,
      title: isTransfer ? 'Перевод между счетами' : title,
      categoryId: isTransfer ? null : categoryId,
      category: isTransfer ? 'Перевод' : category,
      categoryIconName: isTransfer ? 'ArrowLeftRight' : categoryIconName,
      amount,
      date,
      ...(dateISO ? { dateISO } : {}),
      accountId,
      isIncome: isTransfer ? false : entry.isIncome,
      ...(isTransfer ? { isTransfer: true, toAccountId } : {}),
    };
  });
}

export function validateBackupFile(value: unknown): BackupFile {
  if (
    !isRecord(value) ||
    value.format !== BACKUP_FORMAT ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== BACKUP_SCHEMA_VERSION) ||
    !isRecord(value.data)
  ) {
    throw new Error('Это не резервная копия Neo Finance поддерживаемого формата. Исходные данные не изменены.');
  }

  const sourceSchemaVersion = value.schemaVersion;
  const data = value.data;
  if (!isRecord(data.profile) || !isRecord(data.settings)) {
    throw new Error('В резервной копии повреждены профиль или настройки. Исходные данные не изменены.');
  }

  const themeMode = data.settings.themeMode;
  if (typeof themeMode !== 'string' || !SAFE_THEME_MODES.has(themeMode as ThemeMode)) {
    throw new Error('В резервной копии указана неизвестная тема оформления.');
  }

  // Existing schema-version-1 backups predate the background preference and accounts.
  const backgroundStyle = data.settings.backgroundStyle ?? 'gradient';
  if (typeof backgroundStyle !== 'string' || !SAFE_BACKGROUND_STYLES.has(backgroundStyle as BackgroundStyle)) {
    throw new Error('В резервной копии указан неизвестный стиль фона.');
  }

  const rawUserName = requireString(data.profile.userName, 'имя профиля', true) || 'Пользователь';
  if (rawUserName.length > 80) throw new Error('Имя профиля превышает допустимую длину 80 символов.');
  const initialBalance = Math.round(requireFiniteNumber(data.profile.initialBalance, 'начальный баланс'));
  if (!Number.isSafeInteger(initialBalance) || Math.abs(initialBalance) > MAX_TRANSACTION_AMOUNT) {
    throw new Error('Начальный баланс превышает допустимый предел 1 000 000 000 000 ₽.');
  }
  const monthlyBudget = Math.round(requireFiniteNumber(data.profile.monthlyBudget, 'месячный бюджет', { positive: true }));
  if (!Number.isSafeInteger(monthlyBudget) || monthlyBudget <= 0 || monthlyBudget > MAX_TRANSACTION_AMOUNT) {
    throw new Error('Месячный бюджет должен быть целым положительным числом не более 1 000 000 000 000 ₽.');
  }
  const profile = {
    userName: rawUserName,
    // Negative balances are valid (overdraft/debt), while amounts remain whole rubles.
    initialBalance,
    monthlyBudget,
  };

  let transactions = normalizeTransactions(data.transactions);
  let accounts: Account[];

  if (sourceSchemaVersion < 3 && transactions.some((transaction) => transaction.isTransfer)) {
    throw new Error('Переводы поддерживаются только в JSON-бэкапе версии 3 или новее. Исходные данные не изменены.');
  }

  if (sourceSchemaVersion === 1) {
    // Schema 1 did not reliably preserve account records. Re-home every row into
    // the legacy main bucket so no transaction is orphaned during upgrade.
    accounts = createDefaultAccounts(profile.initialBalance);
    transactions = transactions.map((transaction) => ({ ...transaction, accountId: MAIN_ACCOUNT_ID }));
  } else {
    if (!Array.isArray(data.accounts) || data.accounts.length > MAX_IMPORT_ACCOUNTS) {
      throw new Error(`Список счетов отсутствует, повреждён или превышает лимит ${MAX_IMPORT_ACCOUNTS}.`);
    }
    const normalizedAccounts = normalizeStoredAccounts(data.accounts);
    if (!normalizedAccounts) {
      throw new Error('В резервной копии отсутствует список счетов или он повреждён. Исходные данные не изменены.');
    }
    const mainAccount = normalizedAccounts.find((account) => account.id === MAIN_ACCOUNT_ID);
    if (!mainAccount || mainAccount.isArchived || mainAccount.currency !== 'RUB') {
      throw new Error('В резервной копии отсутствует активный основной счёт в RUB. Исходные данные не изменены.');
    }
    // The account model is canonical in schema 2; mirror its opening balance to
    // the historical profile field for older app versions and future compatibility.
    profile.initialBalance = mainAccount.initialBalance;
    accounts = normalizedAccounts;
  }

  const accountRuleFailure = transactions.find((transaction) => getTransactionRuleError(transaction, accounts));
  if (accountRuleFailure) {
    throw new Error(`Транзакция №${accountRuleFailure.id}: ${getTransactionRuleError(accountRuleFailure, accounts)} Исходные данные не изменены.`);
  }

  const normalizedCategories = normalizeCategories(data.categories);
  for (const transaction of transactions) {
    if (transaction.isTransfer || !transaction.categoryId) continue;
    const linkedCategory = normalizedCategories.find((category) => category.id === transaction.categoryId);
    if (linkedCategory && linkedCategory.isIncome !== transaction.isIncome) {
      throw new Error(`Транзакция №${transaction.id} имеет тип, не соответствующий её категории. Исходные данные не изменены.`);
    }
  }

  // Goals were introduced in schema 4. Older backups intentionally restore an
  // empty goal tracker instead of retaining stale goals from the device.
  let goals: Goal[] = [];
  if (sourceSchemaVersion >= 4) {
    if (!Array.isArray(data.goals) || data.goals.length > MAX_IMPORT_GOALS) {
      throw new Error(`Список целей отсутствует, повреждён или превышает лимит ${MAX_IMPORT_GOALS}.`);
    }
    const normalizedGoals = normalizeStoredGoals(data.goals);
    if (!normalizedGoals) {
      throw new Error('В резервной копии отсутствует список целей или он повреждён. Исходные данные не изменены.');
    }
    goals = normalizedGoals;
  }

  return {
    format: BACKUP_FORMAT,
    // Every successfully validated legacy backup is normalized to the current schema.
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'Neo Finance',
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    data: {
      accounts,
      goals,
      transactions,
      categories: normalizedCategories,
      profile,
      settings: { themeMode: themeMode as ThemeMode, backgroundStyle: backgroundStyle as BackgroundStyle },
    },
  };
}

export function createBackupFile(data: BackupData): BackupFile {
  return validateBackupFile({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'Neo Finance',
    exportedAt: new Date().toISOString(),
    data,
  });
}

function downloadBlob(filename: string, content: BlobPart, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBackupFile(backup: BackupFile, mirrorLegacyTimestamp = !hasDatabaseBootstrap()): string {
  const date = backup.exportedAt;
  downloadBlob(`neo-finance-backup-${date.slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
  if (mirrorLegacyTimestamp) {
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, date);
    } catch {
      // The file was still downloaded; the legacy timestamp mirror is optional.
    }
  }
  return date;
}

/** Synchronous compatibility path retained for isolated legacy-format tests. */
export function downloadJsonBackup(data: BackupData): string {
  const exportedAt = downloadBackupFile(createBackupFile(data), !hasDatabaseBootstrap());
  if (hasDatabaseBootstrap()) void persistLastBackupAt(exportedAt).catch(() => undefined);
  return exportedAt;
}

/** Creates a backup from one consistent IndexedDB snapshot, not stale React props. */
export async function createDatabaseBackupFile(): Promise<BackupFile> {
  const snapshot = await readCurrentDatabaseSnapshot();
  return createBackupFile({
    accounts: snapshot.accounts,
    goals: snapshot.goals,
    transactions: snapshot.transactions,
    categories: snapshot.categories,
    profile: { ...snapshot.profile },
    settings: { ...snapshot.settings },
  });
}

export async function downloadJsonBackupFromDatabase(): Promise<string> {
  const backup = await createDatabaseBackupFile();
  // Dexie owns the live backup timestamp. Do not write it into the frozen legacy snapshot.
  const date = downloadBackupFile(backup, false);
  // A failed optional timestamp write must not turn a successfully downloaded
  // backup into a reported export failure.
  await persistLastBackupAt(date).catch(() => undefined);
  return date;
}

function protectSpreadsheetFormula(value: string): string {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const normalized = String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function createTransactionsCsv(transactions: Transaction[]): string {
  // Schema 2 is transaction-complete: account references and both endpoints of
  // internal transfers are preserved. Account definitions/settings still belong
  // in JSON backups, so imports validate that referenced accounts already exist.
  const rows = [CSV_HEADERS_V2, ...transactions.map((transaction) => [
    String(transaction.id),
    String(transaction.amount),
    transaction.isTransfer ? 'transfer' : transaction.isIncome ? 'income' : 'expense',
    transaction.isTransfer ? '' : transaction.categoryId ?? '',
    transaction.isTransfer ? 'Перевод' : transaction.category,
    transaction.isTransfer ? 'ArrowLeftRight' : transaction.categoryIconName || 'HelpCircle',
    transaction.date,
    transaction.dateISO ?? '',
    transaction.accountId?.trim() || MAIN_ACCOUNT_ID,
    transaction.isTransfer ? transaction.toAccountId?.trim() ?? '' : '',
  ])];
  return `\uFEFF${rows.map((row, rowIndex) => row.map((cell, columnIndex) => {
    // Every string-shaped data field is protected, including account/category IDs
    // that may originate in an imported CSV. Numeric cells and the closed type
    // enum are safe by construction.
    const isUserControlledText = rowIndex > 0 && (columnIndex === 3 || (columnIndex >= 4 && columnIndex <= 9));
    const value = isUserControlledText ? protectSpreadsheetFormula(cell) : cell;
    return csvCell(value);
  }).join(',')).join('\r\n')}\r\n`;
}

export function downloadTransactionsCsv(transactions: Transaction[]): void {
  downloadBlob(`neo-finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`, createTransactionsCsv(transactions), 'text/csv;charset=utf-8');
}

/** Exports the current ordered transaction rows directly from Dexie. */
export async function downloadTransactionsCsvFromDatabase(): Promise<number> {
  const transactions = await queryDatabaseTransactions();
  downloadTransactionsCsv(transactions);
  return transactions.length;
}

/** RFC 4180-compatible parser supporting quoted commas, doubled quotes, CRLF and line breaks inside fields. */
function detectCsvDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && (char === '\n' || char === '\r')) break;
    if (!quoted && char === ',') commas += 1;
    if (!quoted && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsvRows(source: string): { rows: string[][]; delimiter: ',' | ';' } {
  const text = source.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) throw new Error('CSV содержит кавычку внутри незакавыченного поля.');
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0) || rows.length > 0) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV-файл обрывается внутри кавычек.');
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return { rows, delimiter };
}

function unprotectSpreadsheetFormula(value: string): string {
  return value.startsWith("'") && /^[\s]*[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
}

export function parseTransactionsCsv(source: string): ParsedTransactionsCsv {
  if (source.length > MAX_CSV_CHARACTERS) throw new Error('CSV-файл слишком большой. Максимальный размер — 50 МБ.');
  const parsedCsv = parseCsvRows(source);
  const { rows, delimiter } = parsedCsv;
  if (rows.length === 0) throw new Error('CSV-файл пустой.');
  if (rows.length - 1 > MAX_IMPORT_TRANSACTIONS) throw new Error(`Слишком много строк CSV. Максимум — ${MAX_IMPORT_TRANSACTIONS} транзакций.`);
  const headers = rows[0].map((header) => header.trim());
  const isV1 = headers.length === CSV_HEADERS_V1.length && CSV_HEADERS_V1.every((header, index) => headers[index] === header);
  const isV2 = headers.length === CSV_HEADERS_V2.length && CSV_HEADERS_V2.every((header, index) => headers[index] === header);
  if (!isV1 && !isV2) {
    throw new Error('Неизвестная структура CSV. Поддерживаются старый формат Neo Finance и расширенный формат v2.');
  }
  const schemaVersion: 1 | 2 = isV2 ? 2 : 1;
  if (rows.length === 1) return { schemaVersion, transactions: [] };

  const result: Transaction[] = [];
  const seenIds = new Set<number>();
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    const expectedColumns = schemaVersion === 1 ? CSV_HEADERS_V1.length : CSV_HEADERS_V2.length;
    if (cells.length !== expectedColumns) throw new Error(`В CSV строка ${index + 1} содержит неверное количество столбцов.`);
    const [idText, amountText, typeText, categoryIdText, categoryText, iconText, dateText, dateISOText] = cells;
    const accountIdText = schemaVersion === 2 ? unprotectSpreadsheetFormula(cells[8]).trim() : MAIN_ACCOUNT_ID;
    const toAccountIdText = schemaVersion === 2 ? unprotectSpreadsheetFormula(cells[9]).trim() : '';
    const safeCategoryIdText = unprotectSpreadsheetFormula(categoryIdText).trim();
    const id = Number(idText);
    const normalizedAmount = delimiter === ';' && amountText.includes(',') && !amountText.includes('.')
      ? amountText.trim().replace(/\s/g, '').replace(',', '.')
      : amountText.trim().replace(/\s/g, '');
    const amount = Number(normalizedAmount);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`В CSV строка ${index + 1}: неверный ID транзакции.`);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) throw new Error(`В CSV строка ${index + 1}: сумма должна быть положительным целым числом рублей не более 1 000 000 000 000.`);
    if (typeText !== 'income' && typeText !== 'expense' && !(schemaVersion === 2 && typeText === 'transfer')) {
      throw new Error(`В CSV строка ${index + 1}: неизвестный тип операции.`);
    }
    if (!dateText.trim()) throw new Error(`В CSV строка ${index + 1}: отсутствует дата.`);
    if (safeCategoryIdText.length > 128 || categoryText.length > 160 || iconText.length > 100 || dateText.length > 80 || dateISOText.length > 10) {
      throw new Error(`В CSV строка ${index + 1}: одно из текстовых полей превышает допустимую длину.`);
    }
    if (seenIds.has(id)) throw new Error(`В CSV повторяется ID транзакции ${id}.`);
    if (schemaVersion === 2 && (!accountIdText || accountIdText.length > 128 || toAccountIdText.length > 128)) {
      throw new Error(`В CSV строка ${index + 1}: отсутствует или неверен идентификатор счёта.`);
    }
    const isTransfer = typeText === 'transfer';
    if (isTransfer && (!toAccountIdText || toAccountIdText === accountIdText)) {
      throw new Error(`В CSV строка ${index + 1}: перевод должен содержать два разных счёта.`);
    }
    if (!isTransfer && toAccountIdText) throw new Error(`В CSV строка ${index + 1}: у обычной операции не должно быть счёта назначения.`);
    seenIds.add(id);
    const category = isTransfer ? 'Перевод' : unprotectSpreadsheetFormula(categoryText);
    const categoryIconName = isTransfer ? 'ArrowLeftRight' : unprotectSpreadsheetFormula(iconText) || 'HelpCircle';
    const date = unprotectSpreadsheetFormula(dateText);
    const dateISO = unprotectSpreadsheetFormula(dateISOText);
    const title = isTransfer ? 'Перевод между счетами' : category || 'Без категории';
    result.push({
      id,
      title,
      categoryId: isTransfer ? null : safeCategoryIdText || null,
      category,
      categoryIconName,
      amount,
      date,
      ...(dateISO.trim() ? { dateISO: dateISO.trim() } : {}),
      accountId: accountIdText,
      ...(isTransfer ? { isTransfer: true, toAccountId: toAccountIdText } : {}),
      isIncome: !isTransfer && typeText === 'income',
    });
  }
  if (result.length === 0) throw new Error('CSV-файл не содержит транзакций.');
  return { schemaVersion, transactions: result };
}

function readStorageSnapshot(keys: string[]): Map<string, string | null> {
  const values = new Map<string, string | null>();
  for (const key of keys) values.set(key, window.localStorage.getItem(key));
  return values;
}

function writeStorageAtomically(entries: Array<[string, string]>): void {
  const keys = entries.map(([key]) => key);
  const previous = readStorageSnapshot(keys);
  const written: string[] = [];
  try {
    for (const [key, value] of entries) {
      window.localStorage.setItem(key, value);
      written.push(key);
    }
  } catch {
    let rollbackFailed = false;
    for (const key of written.reverse()) {
      try {
        const previousValue = previous.get(key);
        if (previousValue === null || previousValue === undefined) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, previousValue);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(rollbackFailed
      ? 'Импорт не удалось завершить, а браузер не смог полностью вернуть прежние значения. Не очищайте данные сайта; скачайте файл восстановления.'
      : 'Браузер не смог сохранить импортированные данные. Прежние значения восстановлены. Освободите место в хранилище или скачайте резервную копию.');
  }
}

export function restoreJsonBackupToStorage(input: unknown): void | Promise<void> {
  const backup = validateBackupFile(input);
  const data = backup.data;
  if (hasDatabaseBootstrap()) return restoreDatabaseSnapshot(data);
  // The synchronous LocalStorage path is retained for isolated legacy-format tests
  // and recovery utilities. The running application always uses the Dexie path.
  writeStorageAtomically([
    [STORAGE_KEYS.transactions, JSON.stringify(data.transactions)],
    [STORAGE_KEYS.accounts, JSON.stringify(data.accounts)],
    [STORAGE_KEYS.goals, JSON.stringify(data.goals)],
    [STORAGE_KEYS.categories, JSON.stringify(data.categories)],
    [STORAGE_KEYS.userName, data.profile.userName],
    [STORAGE_KEYS.initialBalance, String(data.profile.initialBalance)],
    [STORAGE_KEYS.monthlyBudget, String(data.profile.monthlyBudget)],
    [STORAGE_KEYS.theme, data.settings.themeMode],
    [STORAGE_KEYS.backgroundStyle, data.settings.backgroundStyle],
  ]);
}

function createImportCategories(imported: Transaction[], existing: CustomCategory[]): { transactions: Transaction[]; categories: CustomCategory[] } {
  const categories = [...existing];
  const remap = new Map<string, CustomCategory>();
  const mappedTransactions = imported.map((transaction, index) => {
    if (transaction.isTransfer) {
      return { ...transaction, categoryId: null, category: 'Перевод', title: 'Перевод между счетами', categoryIconName: 'ArrowLeftRight', isIncome: false };
    }

    const key = `${transaction.categoryId ?? ''}::${transaction.isIncome ? 'income' : 'expense'}::${transaction.category}`;
    let category = remap.get(key);
    if (!category) {
      category = categories.find((candidate) =>
        transaction.categoryId && candidate.id === transaction.categoryId && candidate.isIncome === transaction.isIncome &&
        candidate.name.trim().toLocaleLowerCase('ru-RU') === transaction.category.trim().toLocaleLowerCase('ru-RU')
      ) ?? categories.find((candidate) =>
        candidate.name.trim().toLocaleLowerCase('ru-RU') === transaction.category.trim().toLocaleLowerCase('ru-RU') &&
        candidate.isIncome === transaction.isIncome
      );
      if (!category) {
        const baseId = transaction.categoryId?.trim() || `import-${transaction.isIncome ? 'income' : 'expense'}-${index + 1}`;
        const id = categories.some((candidate) => candidate.id === baseId)
          ? `import-${baseId}-${Date.now()}-${index}`
          : baseId;
        category = {
          id,
          name: transaction.category.trim() || 'Без категории',
          iconName: transaction.categoryIconName || 'HelpCircle',
          isIncome: transaction.isIncome,
          isArchived: false,
        };
        categories.push(category);
      }
      remap.set(key, category);
    }
    return {
      ...transaction,
      categoryId: category.id,
      category: category.name,
      title: category.name,
      categoryIconName: category.iconName,
    };
  });
  return { transactions: mappedTransactions, categories };
}

export function importCsvTransactionsToStorage(
  importedTransactions: Transaction[],
  existingTransactions: Transaction[],
  existingCategories: CustomCategory[],
  mode: CsvImportMode,
  availableAccounts: readonly Account[],
  csvSchemaVersion: 1 | 2,
): { importedCount: number; skippedCount: number } | Promise<{ importedCount: number; skippedCount: number }> {
  if (importedTransactions.length > MAX_IMPORT_TRANSACTIONS) {
    throw new Error(`Слишком много транзакций. Максимум — ${MAX_IMPORT_TRANSACTIONS}.`);
  }
  const importedIds = new Set<number>();
  for (const transaction of importedTransactions) {
    if (!Number.isSafeInteger(transaction.id) || transaction.id < 0 || importedIds.has(transaction.id)) {
      throw new Error(`CSV содержит повторяющийся или неверный ID транзакции: ${transaction.id}. Исходные данные не изменены.`);
    }
    importedIds.add(transaction.id);
  }
  for (const transaction of importedTransactions) {
    const ruleError = getTransactionRuleError(transaction, availableAccounts);
    if (ruleError) {
      const context = !availableAccounts.some((account) => account.id === (transaction.accountId || MAIN_ACCOUNT_ID))
        ? ' Для полного переноса между устройствами используйте JSON-бэкап или сначала создайте соответствующие счета.'
        : '';
      throw new Error(`CSV содержит некорректную транзакцию №${transaction.id}: ${ruleError}${context} Исходные данные не изменены.`);
    }
  }

  let skippedCount = 0;
  let sourceTransactions = importedTransactions;
  if (mode === 'append') {
    const existingIds = new Set(existingTransactions.map((transaction) => transaction.id));
    const incomingIds = new Set<number>();
    sourceTransactions = importedTransactions.filter((transaction) => {
      if (existingIds.has(transaction.id) || incomingIds.has(transaction.id)) {
        skippedCount += 1;
        return false;
      }
      incomingIds.add(transaction.id);
      return true;
    });
  }

  const mapped = createImportCategories(sourceTransactions, existingCategories);
  let transactions: Transaction[];
  if (mode === 'replace' && csvSchemaVersion === 1) {
    // Legacy eight-column CSV cannot express account assignments or transfers.
    // Retain current transfers on replace so an older file cannot erase them.
    const existingTransfers = existingTransactions.filter((transaction) => transaction.isTransfer);
    let nextAvailableId = Date.now();
    const usedIds = new Set(mapped.transactions.map((transaction) => transaction.id));
    const preservedTransfers = existingTransfers.map((transaction) => {
      let id = transaction.id;
      if (usedIds.has(id)) {
        while (usedIds.has(nextAvailableId)) nextAvailableId += 1;
        id = nextAvailableId;
        nextAvailableId += 1;
      }
      usedIds.add(id);
      return id === transaction.id ? transaction : { ...transaction, id };
    });
    transactions = [...mapped.transactions, ...preservedTransfers];
  } else if (mode === 'replace') {
    // Schema 2 fully represents the transaction set; replace really replaces all rows.
    transactions = mapped.transactions;
  } else {
    transactions = [...mapped.transactions, ...existingTransactions];
  }

  const result = { importedCount: mapped.transactions.length, skippedCount };
  if (hasDatabaseBootstrap()) return persistCsvImport(transactions, mapped.categories).then(() => result);
  writeStorageAtomically([
    [STORAGE_KEYS.categories, JSON.stringify(mapped.categories)],
    [STORAGE_KEYS.transactions, JSON.stringify(transactions)],
  ]);
  return result;
}

export function readLastBackupAt(): string | null {
  const snapshot = getDatabaseBootstrapSnapshot();
  if (snapshot) return snapshot.lastBackupAt;
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}
