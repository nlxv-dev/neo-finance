import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalISODate } from '@/data/transactionDates';

interface DayPickerProps {
  date: Date;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
}

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});
const shortDateWithYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function getDayLabel(date: Date, today: Date): string {
  const dateKey = toLocalISODate(date);
  const todayKey = toLocalISODate(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayKey = toLocalISODate(yesterday);

  if (dateKey === todayKey) return 'Сегодня';
  if (dateKey === yesterdayKey) return 'Вчера';
  if (date.getFullYear() !== today.getFullYear()) return shortDateWithYearFormatter.format(date);
  return shortDateFormatter.format(date).replace(/\.$/, '');
}

export function DayPicker({ date, onPrevious, onNext, canGoNext = true }: DayPickerProps) {
  const label = getDayLabel(date, new Date());
  const accessibleDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return (
    <div className="flex shrink-0 select-none items-center gap-1 rounded-full bg-neutral-100/90 p-1 dark:bg-neutral-800/70">
      <button
        type="button"
        onClick={onPrevious}
        className="flex h-8 w-7 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-white/80 active:scale-90 dark:text-neutral-300 dark:hover:bg-neutral-700"
        aria-label="Предыдущий день"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div
        role="group"
        aria-label={`Выбранная дата: ${accessibleDate}`}
        className="flex min-w-[84px] select-none items-center justify-center gap-1 px-1 text-[10px] font-medium text-neutral-700 dark:text-neutral-200"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex h-8 w-7 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-white/80 active:scale-90 disabled:opacity-25 dark:text-neutral-300 dark:hover:bg-neutral-700"
        aria-label="Следующий день"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
