import { getBudgetStatus, type BudgetStatus } from '@/data/mockData';
import { formatCurrency } from '@/utils/formatters';

interface BudgetIndicatorProps {
  spent: number;
  budget: number;
  safeToSpend: number;
  onEditBudget: () => void;
}

const TICK_COUNT = 40;

const normalStops = ['#4ADE80', '#05D9A4', '#6366F1'] as const;
const warningStops = ['#F59E0B', '#FB923C'] as const;

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixColors(start: string, end: string, amount: number): string {
  const a = parseHex(start);
  const b = parseHex(end);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function getTickColor(index: number, status: BudgetStatus): string {
  const position = index / (TICK_COUNT - 1);

  if (status === 'overbudget') return '#EF4444';
  if (status === 'warning') return mixColors(warningStops[0], warningStops[1], position);
  if (position <= 0.5) return mixColors(normalStops[0], normalStops[1], position * 2);
  return mixColors(normalStops[1], normalStops[2], (position - 0.5) * 2);
}

export function BudgetIndicator({ spent, budget, safeToSpend, onEditBudget }: BudgetIndicatorProps) {
  const status = getBudgetStatus(spent, budget);
  const isOverbudget = spent > budget;
  const spentPercent = budget > 0 ? Math.round((spent / budget) * 100) : spent > 0 ? 100 : 0;
  const spentRatio = budget > 0 ? Math.min(1, Math.max(0, spent / budget)) : spent > 0 ? 1 : 0;
  const activeTicks = Math.round(spentRatio * TICK_COUNT);
  const displayedAmount = `${isOverbudget ? '−' : ''}${formatCurrency(Math.abs(Math.round(safeToSpend)))}`;
  const accessibleProgress = Math.min(100, Math.max(0, spentPercent));

  return (
    <div className="w-full pt-3">
      <div className="flex flex-col items-center">
        <span className="text-center text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
          {isOverbudget ? 'Перерасход' : 'Доступно к трате'}
        </span>

        <button
          type="button"
          onClick={onEditBudget}
          aria-label={`Изменить месячный бюджет: ${formatCurrency(budget)} рублей`}
          className="mt-1 inline-flex max-w-full items-baseline justify-center rounded-lg px-2 py-1 text-neutral-900 transition-opacity hover:opacity-80 active:opacity-60 dark:text-white "
        >
          <span
            className={`max-w-full whitespace-nowrap text-4xl font-light leading-none tracking-tight tabular-nums sm:text-[2.65rem] ${
              isOverbudget ? 'text-red-500 dark:text-red-400' : ''
            }`}
          >
            {displayedAmount}
            <span className="ml-1 text-[0.58em] text-neutral-400 dark:text-neutral-500">₽</span>
          </span>
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Использование месячного бюджета"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={accessibleProgress}
        aria-valuetext={`${spentPercent}% бюджета потрачено`}
        className="budget-ticks mt-5 flex w-full items-center justify-between px-0.5"
      >
        {Array.from({ length: TICK_COUNT }, (_, index) => {
          const isActive = index < activeTicks;

          return (
            <span
              key={index}
              aria-hidden="true"
              className={`budget-tick h-[17px] w-[3px] shrink-0 rounded-full ${
                isActive ? 'opacity-95' : 'bg-neutral-300/60 opacity-60 dark:bg-neutral-700/70 dark:opacity-70'
              }`}
              style={{
                backgroundColor: isActive ? getTickColor(index, status) : undefined,
                transition: 'background-color 280ms ease, opacity 280ms ease',
              }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] leading-4 text-neutral-400 dark:text-neutral-500">
        <span className="min-w-0 truncate">{formatCurrency(spent)} ₽ потрачено</span>
        <span className={`shrink-0 text-right ${isOverbudget ? 'font-medium text-red-500 dark:text-red-400' : ''}`}>
          {isOverbudget
            ? `−${formatCurrency(Math.abs(safeToSpend))} ₽ перерасход`
            : `${formatCurrency(Math.max(0, safeToSpend))} ₽ осталось`}
        </span>
      </div>

      <div className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-neutral-200/70 pt-2 dark:border-white/[0.07]">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: getTickColor(Math.max(0, activeTicks - 1), status) }}
          />
          <span className="truncate">Потрачено {spentPercent}%</span>
        </span>

        <button
          type="button"
          onClick={onEditBudget}
          aria-label={`Изменить месячный бюджет: ${formatCurrency(budget)} рублей`}
          className="min-h-11 shrink-0 rounded-md text-[11px] text-neutral-500 transition-opacity hover:opacity-75 active:opacity-60 dark:text-neutral-400"
        >
          Бюджет {formatCurrency(budget)} ₽
        </button>
      </div>
    </div>
  );
}
