import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrentMonth } from '@/hooks/useCurrentMonth';

interface MonthPickerProps {
  /**
   * Month currently in view. Falls back to the live current month, which keeps
   * the picker usable as a standalone current-month control.
   */
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
}

export function MonthPicker({
  label,
  onPrevious,
  onNext,
  canGoNext = true,
}: MonthPickerProps) {
  const { monthLabel } = useCurrentMonth();
  const displayedLabel = label ?? monthLabel;

  return (
    <div className="flex select-none items-center gap-1 rounded-full bg-neutral-100/90 p-1 dark:bg-neutral-800/70">
      <button
        type="button"
        onClick={onPrevious}
        className="flex h-8 w-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/80 active:scale-90 dark:text-neutral-400 dark:hover:bg-neutral-700"
        aria-label="Предыдущий месяц"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex min-w-[96px] select-none items-center justify-center gap-1 px-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="select-none">{displayedLabel}</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex h-8 w-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/80 active:scale-90 disabled:opacity-25 dark:text-neutral-400 dark:hover:bg-neutral-700"
        aria-label="Следующий месяц"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
