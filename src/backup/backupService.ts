import type { Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import type { ThemeMode } from '@/hooks/useTheme';

// These historical browser-storage keys are intentionally preserved until a separate, tested migration exists.
export const STORAGE_KEYS = {
  transactions: 'fintrack-transactions',
  categories: 'neo_finance_categories',
  userName: 'fintrack-user-name',
  initialBalance: 'fintrack-initial-balance',
  monthlyBudget: 'fintrack-monthly-budget',
  theme: 'fintrack-theme',
} as const;

export const LAST_BACKUP_KEY = 'neo-finance-last-backup';
export const BACKUP_FORMAT = 'neo-finance-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  transactions: Transaction[];
  categories: CustomCategory[];
  profile: {
    userName: string;
    initialBalance: number;
    monthlyBudget: number;
  };
  settings: {
    themeMode: ThemeMode;
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

const CSV_HEADERS = ['id', 'amount', 'type', 'categoryId', 'category', 'categoryIconName', 'date', 'dateISO'];
const SAFE_THEME_MODES = new Set<ThemeMode>(['system', 'light', 'dark']);

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
  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Категория №${index + 1} имеет неверный формат.`);
    const id = requireString(entry.id, `id категории №${index + 1}`);
    if (entry.isArchived !== undefined && typeof entry.isArchived !== 'boolean') {
      throw new Error(`Статус архива категории №${index + 1} указан неверно.`);
    }
    if (ids.has(id)) throw new Error(`В резервной копии повторяется ID категории «${id}».`);
    ids.add(id);
    return {
      id,
      name: requireString(entry.name, `название категории №${index + 1}`),
      iconName: requireString(entry.iconName, `иконка категории №${index + 1}`),
      isIncome: typeof entry.isIncome === 'boolean' ? entry.isIncome : (() => { throw new Error(`Тип категории №${index + 1} указан неверно.`); })(),
      isArchived: entry.isArchived === true,
    };
  });
}

function normalizeTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) throw new Error('В резервной копии отсутствует история транзакций.');
  const ids = new Set<number>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Транзакция №${index + 1} имеет неверный формат.`);
    const id = requireFiniteNumber(entry.id, `ID транзакции №${index + 1}`, { nonNegative: true });
    if (!Number.isSafeInteger(id)) throw new Error(`ID транзакции №${index + 1} должен быть целым числом.`);
    if (ids.has(id)) throw new Error(`В резервной копии повторяется ID транзакции ${id}.`);
    ids.add(id);
    const amount = requireFiniteNumber(entry.amount, `сумма транзакции №${index + 1}`, { nonNegative: true });
    if (typeof entry.isIncome !== 'boolean') throw new Error(`Тип транзакции №${index + 1} указан неверно.`);
    const categoryId = entry.categoryId === null ? null : requireString(entry.categoryId, `categoryId транзакции №${index + 1}`, true) || null;
    const category = requireString(entry.category, `категория транзакции №${index + 1}`, true);
    const title = typeof entry.title === 'string' ? entry.title : category;
    const categoryIconName = typeof entry.categoryIconName === 'string' && entry.categoryIconName
      ? entry.categoryIconName
      : 'HelpCircle';
    const date = requireString(entry.date, `дата транзакции №${index + 1}`, true);
    const dateISO = typeof entry.dateISO === 'string' && entry.dateISO ? entry.dateISO : undefined;
    return { id, title, categoryId, category, categoryIconName, amount, date, ...(dateISO ? { dateISO } : {}), isIncome: entry.isIncome };
  });
}

export function validateBackupFile(value: unknown): BackupFile {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.schemaVersion !== BACKUP_SCHEMA_VERSION || !isRecord(value.data)) {
    throw new Error('Это не резервная копия Neo Finance поддерживаемого формата. Исходные данные не изменены.');
  }

  const data = value.data;
  if (!isRecord(data.profile) || !isRecord(data.settings)) {
    throw new Error('В резервной копии повреждены профиль или настройки. Исходные данные не изменены.');
  }

  const themeMode = data.settings.themeMode;
  if (typeof themeMode !== 'string' || !SAFE_THEME_MODES.has(themeMode as ThemeMode)) {
    throw new Error('В резервной копии указана неизвестная тема оформления.');
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'Neo Finance',
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    data: {
      transactions: normalizeTransactions(data.transactions),
      categories: normalizeCategories(data.categories),
      profile: {
        userName: requireString(data.profile.userName, 'имя профиля', true) || 'Пользователь',
        initialBalance: requireFiniteNumber(data.profile.initialBalance, 'начальный баланс', { nonNegative: true }),
        monthlyBudget: requireFiniteNumber(data.profile.monthlyBudget, 'месячный бюджет', { positive: true }),
      },
      settings: { themeMode: themeMode as ThemeMode },
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

export function downloadJsonBackup(data: BackupData): string {
  const backup = createBackupFile(data);
  const date = new Date().toISOString();
  downloadBlob(`neo-finance-backup-${date.slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, date);
  } catch {
    // The file was still downloaded; backup metadata is optional.
  }
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
  const rows = [CSV_HEADERS, ...transactions.map((transaction) => [
    String(transaction.id),
    String(transaction.amount),
    transaction.isIncome ? 'income' : 'expense',
    transaction.categoryId ?? '',
    transaction.category,
    transaction.categoryIconName || 'HelpCircle',
    transaction.date,
    transaction.dateISO ?? '',
  ])];
  return `\uFEFF${rows.map((row, rowIndex) => row.map((cell, columnIndex) => {
    const isUserControlledText = rowIndex > 0 && columnIndex >= 4;
    const value = isUserControlledText ? protectSpreadsheetFormula(cell) : cell;
    return csvCell(value);
  }).join(',')).join('\r\n')}\r\n`;
}

export function downloadTransactionsCsv(transactions: Transaction[]): void {
  downloadBlob(`neo-finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`, createTransactionsCsv(transactions), 'text/csv;charset=utf-8');
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

export function parseTransactionsCsv(source: string): Transaction[] {
  const parsedCsv = parseCsvRows(source);
  const { rows, delimiter } = parsedCsv;
  if (rows.length === 0) throw new Error('CSV-файл пустой.');
  const headers = rows[0].map((header) => header.trim());
  if (headers.length !== CSV_HEADERS.length || CSV_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error('Неизвестная структура CSV. Используйте CSV-экспорт Neo Finance с исходными заголовками.');
  }
  if (rows.length === 1) return [];

  const result: Transaction[] = [];
  const seenIds = new Set<number>();
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    if (cells.length !== CSV_HEADERS.length) throw new Error(`В CSV строка ${index + 1} содержит неверное количество столбцов.`);
    const [idText, amountText, typeText, categoryIdText, categoryText, iconText, dateText, dateISOText] = cells;
    const id = Number(idText);
    const normalizedAmount = delimiter === ';' && amountText.includes(',') && !amountText.includes('.')
      ? amountText.trim().replace(/\s/g, '').replace(',', '.')
      : amountText.trim().replace(/\s/g, '');
    const amount = Number(normalizedAmount);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`В CSV строка ${index + 1}: неверный ID транзакции.`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`В CSV строка ${index + 1}: сумма должна быть положительным числом.`);
    if (typeText !== 'income' && typeText !== 'expense') throw new Error(`В CSV строка ${index + 1}: тип должен быть income или expense.`);
    if (!dateText.trim()) throw new Error(`В CSV строка ${index + 1}: отсутствует дата.`);
    if (seenIds.has(id)) throw new Error(`В CSV повторяется ID транзакции ${id}.`);
    seenIds.add(id);
    const category = unprotectSpreadsheetFormula(categoryText);
    const categoryIconName = unprotectSpreadsheetFormula(iconText) || 'HelpCircle';
    const date = unprotectSpreadsheetFormula(dateText);
    const dateISO = unprotectSpreadsheetFormula(dateISOText);
    const title = category || 'Без категории';
    result.push({
      id,
      title,
      categoryId: categoryIdText.trim() || null,
      category,
      categoryIconName,
      amount,
      date,
      ...(dateISO.trim() ? { dateISO: dateISO.trim() } : {}),
      isIncome: typeText === 'income',
    });
  }
  if (result.length === 0) throw new Error('CSV-файл не содержит транзакций.');
  return result;
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

export function restoreJsonBackupToStorage(input: unknown): void {
  const backup = validateBackupFile(input);
  const data = backup.data;
  writeStorageAtomically([
    [STORAGE_KEYS.transactions, JSON.stringify(data.transactions)],
    [STORAGE_KEYS.categories, JSON.stringify(data.categories)],
    [STORAGE_KEYS.userName, data.profile.userName],
    [STORAGE_KEYS.initialBalance, String(data.profile.initialBalance)],
    [STORAGE_KEYS.monthlyBudget, String(data.profile.monthlyBudget)],
    [STORAGE_KEYS.theme, data.settings.themeMode],
  ]);
}

function createImportCategories(imported: Transaction[], existing: CustomCategory[]): { transactions: Transaction[]; categories: CustomCategory[] } {
  const categories = [...existing];
  const remap = new Map<string, CustomCategory>();
  const mappedTransactions = imported.map((transaction, index) => {
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
  mode: CsvImportMode
): { importedCount: number; skippedCount: number } {
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
  const transactions = mode === 'replace' ? mapped.transactions : [...mapped.transactions, ...existingTransactions];

  writeStorageAtomically([
    [STORAGE_KEYS.categories, JSON.stringify(mapped.categories)],
    [STORAGE_KEYS.transactions, JSON.stringify(transactions)],
  ]);
  return { importedCount: mapped.transactions.length, skippedCount };
}

export function readLastBackupAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}
