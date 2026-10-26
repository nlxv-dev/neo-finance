/** Currency presentation shared by account, transaction and analytics screens. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

export function getCurrencySymbol(currency: string): string {
  const code = currency.trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? (code || 'RUB');
}
