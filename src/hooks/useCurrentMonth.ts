import { useEffect, useMemo, useState } from 'react';
import { monthNameFormatter } from '@/utils/formatters';

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  const monthName = monthNameFormatter.format(new Date(year, month - 1, 1));

  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

export function useCurrentMonth() {
  const [currentMonthKey, setCurrentMonthKey] = useState(() => getMonthKey(new Date()));

  useEffect(() => {
    const sync = () => {
      const nextKey = getMonthKey(new Date());
      setCurrentMonthKey((previousKey) => (previousKey === nextKey ? previousKey : nextKey));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') sync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', sync);
    const intervalId = window.setInterval(sync, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', sync);
      window.clearInterval(intervalId);
    };
  }, []);

  const monthLabel = useMemo(() => formatMonthLabel(currentMonthKey), [currentMonthKey]);

  return { currentMonthKey, monthLabel };
}
