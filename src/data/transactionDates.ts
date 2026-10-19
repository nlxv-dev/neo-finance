import type { Transaction } from '@/data/mockData';

const LEGACY_MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const LEGACY_MONTH_ALIASES: Record<string, number> = {
  январь: 0, января: 0, янв: 0,
  февраль: 1, февраля: 1, фев: 1,
  март: 2, марта: 2, мар: 2,
  апрель: 3, апреля: 3, апр: 3,
  май: 4, мая: 4,
  июнь: 5, июня: 5, июн: 5,
  июль: 6, июля: 6, июл: 6,
  август: 7, августа: 7, авг: 7,
  сентябрь: 8, сентября: 8, сент: 8, сен: 8,
  октябрь: 9, октября: 9, окт: 9,
  ноябрь: 10, ноября: 10, ноя: 10,
  декабрь: 11, декабря: 11, дек: 11,
};

export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isISODateString(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function isValidISODate(value: string | undefined): value is string {
  return isISODateString(value);
}

/**
 * Older transactions stored only a display date (for example, "16 окт").
 * Their numeric ID was created with Date.now(), so it often preserves the exact
 * original date. If it does not, the most recent past occurrence is used as a
 * best-effort fallback because the original year cannot be reconstructed.
 */
export function resolveTransactionDateISO(
  transaction: Pick<Transaction, 'id' | 'date' | 'dateISO'>,
  referenceDate = new Date()
): string | undefined {
  if (isValidISODate(transaction.dateISO)) return transaction.dateISO;
  if (isISODateString(transaction.date)) return transaction.date;

  const idDate = new Date(transaction.id);
  const earliestSupportedTimestamp = new Date(2018, 0, 1).getTime();
  const latestSupportedTimestamp = referenceDate.getTime() + 24 * 60 * 60 * 1000;
  if (
    Number.isSafeInteger(transaction.id) &&
    transaction.id >= earliestSupportedTimestamp &&
    transaction.id <= latestSupportedTimestamp &&
    !Number.isNaN(idDate.getTime())
  ) {
    return toLocalISODate(idDate);
  }

  const match = transaction.date.trim().toLocaleLowerCase('ru-RU').match(/^(\d{1,2})\s+([а-яё]+)/i);
  if (!match) return undefined;

  const day = Number(match[1]);
  const monthText = match[2];
  const monthIndex = LEGACY_MONTH_ALIASES[monthText] ?? LEGACY_MONTHS.findIndex((month) => monthText.startsWith(month));
  if (monthIndex < 0 || day < 1 || day > 31) return undefined;

  let year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  if (monthIndex > currentMonth || (monthIndex === currentMonth && day > referenceDate.getDate())) {
    year -= 1;
  }

  const parsed = new Date(year, monthIndex, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== monthIndex || parsed.getDate() !== day) {
    return undefined;
  }
  return toLocalISODate(parsed);
}

export function formatISODateShort(isoDate: string): string {
  if (!isISODateString(isoDate)) return isoDate;
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${LEGACY_MONTHS[month - 1]}`;
}
