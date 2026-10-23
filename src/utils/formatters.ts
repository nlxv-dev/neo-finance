/** Intl instances are expensive to create; keep them at module scope. */
export const currencyFormatter = new Intl.NumberFormat('ru-RU');

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export const monthNameFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
});

export const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
