import { useMemo, useState, type PointerEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { IconRenderer } from '@/components/IconRenderer';
import { MonthPicker } from '@/components/MonthPicker';
import { DayPicker } from '@/components/DayPicker';
import { formatCurrency, type Transaction } from '@/data/mockData';
import { formatISODateShort, resolveTransactionDateISO, toLocalISODate } from '@/data/transactionDates';
import type { CustomCategory } from '@/data/categories';
import {
  buildCategoryPeriodChanges,
  buildCategoryStatistics,
  buildDailyStatistics,
  calculatePeriodStatistics,
  getDaysInMonth,
  getMonthKey,
  getStatisticsComparisonPeriods,
  selectStatisticsTransactions,
  selectStatisticsTransactionsInRange,
  type StatisticsPeriodMode,
  type StatisticsViewMode,
} from '@/utils/financialAnalytics';

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const SHORT_MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});
const LONG_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function makeLinePath(values: number[], maxValue: number): string {
  if (values.length < 2 || maxValue <= 0) return '';

  const left = 10;
  const right = 310;
  const top = 10;
  const bottom = 112;
  const points = values.map((value, index) => ({
    x: left + (index / (values.length - 1)) * (right - left),
    y: bottom - (value / maxValue) * (bottom - top),
  }));

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const following = points[Math.min(points.length - 1, index + 2)];
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;
    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
  }
  return path;
}

function getPointX(dayIndex: number, totalDays: number): number {
  if (totalDays <= 1) return 160;
  return 10 + (dayIndex / (totalDays - 1)) * 300;
}

function getPointY(value: number, maxValue: number): number {
  if (maxValue <= 0) return 112;
  return 112 - (value / maxValue) * 102;
}

function formatSignedCurrency(amount: number): string {
  if (amount < 0) return `−${formatCurrency(Math.abs(amount))}`;
  if (amount > 0) return `+${formatCurrency(amount)}`;
  return '0';
}

function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatComparisonRangeLabel(startDateISO: string, endDateISO: string): string {
  const start = parseLocalDateKey(startDateISO);
  const end = parseLocalDateKey(endDateISO);
  if (startDateISO === endDateISO) {
    return `${start.getDate()} ${SHORT_MONTHS_RU[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${SHORT_MONTHS_RU[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${SHORT_MONTHS_RU[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()} ${SHORT_MONTHS_RU[end.getMonth()]} ${end.getFullYear()}`;
}

function getComparisonHeadline(
  mode: StatisticsViewMode,
  currentValue: number,
  previousValue: number,
): string {
  const difference = currentValue - previousValue;
  if (mode === 'all') {
    if (difference === 0) return 'Чистый итог без изменений';
    return `Чистый итог ${difference > 0 ? 'выше' : 'ниже'} на ${formatCurrency(Math.abs(difference))} ₽`;
  }

  const metricLabel = mode === 'income' ? 'Доходы' : 'Расходы';
  const metricGenitive = mode === 'income' ? 'доходов' : 'расходов';
  if (currentValue === 0 && previousValue === 0) {
    return `${metricLabel}: ${metricGenitive} не было ни в одном периоде`;
  }
  if (previousValue === 0) return `В предыдущем периоде ${metricGenitive} не было`;
  if (difference === 0) return `${metricLabel} без изменений`;

  const percent = Math.max(1, Math.round((Math.abs(difference) / previousValue) * 100));
  return `${metricLabel} ${difference > 0 ? 'выросли' : 'снизились'} на ${percent}%`;
}

function formatComparisonMetric(mode: StatisticsViewMode, value: number): string {
  return mode === 'all' ? formatSignedCurrency(value) : formatCurrency(value);
}

export function StatisticsScreen({
  transactions,
  categories,
  otherCurrencyCodes = [],
  onSelectTransaction,
}: {
  transactions: Transaction[];
  categories: CustomCategory[];
  otherCurrencyCodes?: string[];
  onSelectTransaction: (transaction: Transaction) => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [periodMode, setPeriodMode] = useState<StatisticsPeriodMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [mode, setMode] = useState<StatisticsViewMode>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const selectedMonthKey = getMonthKey(selectedMonth);
  const isCurrentMonth = currentMonthKey === selectedMonthKey;
  const currentDateKey = toLocalISODate(now);
  const referenceDate = useMemo(() => {
    const [year, month, day] = currentDateKey.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }, [currentDateKey]);
  const selectedDateKey = toLocalISODate(selectedDate);
  const isCurrentDay = currentDateKey === selectedDateKey;
  const monthDays = getDaysInMonth(selectedMonth);
  const visibleDays = isCurrentMonth ? now.getDate() : monthDays;
  const monthLabel = `${MONTHS_RU[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;

  const periodTransactions = useMemo(
    () => selectStatisticsTransactions(transactions, selectedMonthKey, periodMode, selectedDateKey, referenceDate),
    [transactions, selectedMonthKey, periodMode, selectedDateKey, referenceDate]
  );

  const comparisonPeriods = useMemo(
    () => getStatisticsComparisonPeriods(periodMode, selectedMonthKey, selectedDateKey, referenceDate),
    [periodMode, selectedMonthKey, selectedDateKey, referenceDate],
  );
  const previousPeriodTransactions = useMemo(
    () => selectStatisticsTransactionsInRange(transactions, comparisonPeriods.previous, referenceDate),
    [transactions, comparisonPeriods, referenceDate],
  );
  const previousPeriodTotals = useMemo(
    () => calculatePeriodStatistics(previousPeriodTransactions),
    [previousPeriodTransactions],
  );

  const categoryPeriodChanges = useMemo(
    () => buildCategoryPeriodChanges(periodTransactions, previousPeriodTransactions, categories, mode),
    [periodTransactions, previousPeriodTransactions, categories, mode],
  );
  const hasCategoryPeriodData = useMemo(
    () => [periodTransactions, previousPeriodTransactions].some((list) =>
      list.some((transaction) =>
        !transaction.isTransfer &&
        Number.isFinite(transaction.amount) &&
        transaction.isIncome === (mode === 'income'),
      ),
    ),
    [periodTransactions, previousPeriodTransactions, mode],
  );

  const periodTotals = useMemo(
    () => calculatePeriodStatistics(periodTransactions),
    [periodTransactions]
  );
  const { income: periodIncome, expenses: periodExpenses, net: netPeriodTotal } = periodTotals;

  const chartData = useMemo(
    () => periodMode === 'day' ? [] : buildDailyStatistics(periodTransactions, visibleDays),
    [periodTransactions, visibleDays, periodMode]
  );

  const chartMaximum = useMemo(() => {
    const values = chartData.flatMap((point) => {
      if (mode === 'income') return [point.income];
      if (mode === 'expense') return [point.expenses];
      return [point.income, point.expenses];
    });
    return Math.max(1, ...values) * 1.18;
  }, [chartData, mode]);

  const incomePath = useMemo(
    () => makeLinePath(chartData.map((point) => point.income), chartMaximum),
    [chartData, chartMaximum]
  );
  const expensesPath = useMemo(
    () => makeLinePath(chartData.map((point) => point.expenses), chartMaximum),
    [chartData, chartMaximum]
  );

  const categoryStats = useMemo(
    () => buildCategoryStatistics(periodTransactions, categories, mode, periodIncome, periodExpenses),
    [periodTransactions, categories, mode, periodIncome, periodExpenses]
  );
  const displayedCategories = showAllCategories ? categoryStats : categoryStats.slice(0, 5);
  const selectedDateLabel = (() => {
    if (isCurrentDay) return 'сегодня';
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (selectedDateKey === toLocalISODate(yesterday)) return 'вчера';
    return (selectedDate.getFullYear() !== now.getFullYear()
      ? LONG_DATE_WITH_YEAR_FORMATTER
      : LONG_DATE_FORMATTER).format(selectedDate);
  })();
  const periodLabel = periodMode === 'day'
    ? `за ${selectedDateLabel}`
    : `за ${MONTHS_RU[selectedMonth.getMonth()].toLocaleLowerCase('ru-RU')}`;
  const heroLabel = mode === 'all'
    ? `Итог ${periodLabel}`
    : mode === 'income'
      ? `Доходы ${periodLabel}`
      : `Расходы ${periodLabel}`;
  const heroAmount = mode === 'all' ? netPeriodTotal : mode === 'income' ? periodIncome : periodExpenses;
  const previousHeroAmount = mode === 'all'
    ? previousPeriodTotals.net
    : mode === 'income' ? previousPeriodTotals.income : previousPeriodTotals.expenses;
  const comparisonHeadline = getComparisonHeadline(mode, heroAmount, previousHeroAmount);
  const currentComparisonLabel = formatComparisonRangeLabel(
    comparisonPeriods.current.startDateISO,
    comparisonPeriods.current.endDateISO,
  );
  const previousComparisonLabel = formatComparisonRangeLabel(
    comparisonPeriods.previous.startDateISO,
    comparisonPeriods.previous.endDateISO,
  );
  const chartHasData = mode === 'income' ? periodIncome > 0 : mode === 'expense' ? periodExpenses > 0 : periodIncome > 0 || periodExpenses > 0;
  const categoryTitle = mode === 'income' ? 'Доходы по категориям' : 'Расходы по категориям';

  const selectedPoint = selectedDay ? chartData[selectedDay - 1] : null;
  const monthTicks = useMemo(() => {
    const fractions = [0, 0.25, 0.5, 0.75, 1];
    return Array.from(new Set(fractions.map((fraction) => Math.round(1 + fraction * (visibleDays - 1)))));
  }, [visibleDays]);

  const moveMonth = (direction: -1 | 1) => {
    setSelectedDay(null);
    setSelectedCategoryKey(null);
    setShowAllCategories(false);
    setSelectedMonth((previous) => {
      const target = new Date(previous.getFullYear(), previous.getMonth() + direction, 1);
      const today = new Date();
      if (target.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime()) {
        return new Date(today.getFullYear(), today.getMonth(), 1);
      }
      return target;
    });
  };

  const moveDay = (direction: -1 | 1) => {
    setSelectedDay(null);
    setSelectedCategoryKey(null);
    setShowAllCategories(false);
    setSelectedDate((previous) => {
      const target = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + direction);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return target > todayStart ? previous : target;
    });
  };

  const selectPeriod = (nextMode: StatisticsPeriodMode) => {
    if (nextMode === periodMode) return;
    setPeriodMode(nextMode);
    setSelectedDay(null);
    setSelectedCategoryKey(null);
    setShowAllCategories(false);

    if (nextMode === 'day') {
      const today = new Date();
      const selectedDateMonthKey = getMonthKey(selectedDate);
      const monthIsCurrent = selectedMonthKey === getMonthKey(today);
      // Preserve the previously selected day when returning from Month view.
      // If the user has navigated to a different month, choose its last day;
      // never offer a future date in the current month.
      if (selectedDateMonthKey !== selectedMonthKey) {
        setSelectedDate(monthIsCurrent
          ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
          : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0));
      }
    } else {
      setSelectedMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  };

  const selectMode = (nextMode: StatisticsViewMode) => {
    setMode(nextMode);
    setSelectedDay(null);
    setSelectedCategoryKey(null);
    setShowAllCategories(false);
  };

  const handleChartPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || chartData.length === 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 320;
    const progress = Math.max(0, Math.min(1, (x - 10) / 300));
    setSelectedDay(Math.round(progress * (chartData.length - 1)) + 1);
  };


  const signedHero = mode === 'all' ? formatSignedCurrency(heroAmount) : formatCurrency(heroAmount);

  return (
    <div className="px-5 pt-12 pb-12 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            Статистика
          </h1>
          {periodMode === 'month' ? (
            <MonthPicker
              label={monthLabel}
              onPrevious={() => moveMonth(-1)}
              onNext={() => moveMonth(1)}
              canGoNext={!isCurrentMonth}
            />
          ) : (
            <DayPicker
              date={selectedDate}
              onPrevious={() => moveDay(-1)}
              onNext={() => moveDay(1)}
              canGoNext={!isCurrentDay}
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100/80 p-1 dark:bg-neutral-800/70" role="group" aria-label="Период статистики">
          {([
            { id: 'day', label: 'День' },
            { id: 'month', label: 'Месяц' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPeriod(item.id)}
              aria-pressed={periodMode === item.id}
              className={`rounded-full px-3 py-2 text-xs font-medium transition-all active:scale-[0.98] ${
                periodMode === item.id
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-neutral-100/80 p-1 dark:bg-neutral-800/70">
          {([
            { id: 'all', label: 'Все' },
            { id: 'income', label: 'Доходы' },
            { id: 'expense', label: 'Расходы' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectMode(item.id)}
              className={`rounded-full px-2 py-2.5 text-xs font-medium transition-all active:scale-[0.98] ${
                mode === item.id
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              aria-pressed={mode === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {otherCurrencyCodes.length > 0 && (
        <p role="note" className="mb-3 rounded-xl neu-inset px-3 py-2.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          Статистика и бюджет показаны в RUB. Операции в {otherCurrencyCodes.join(', ')} доступны отдельно в Кошельке и не складываются с рублями.
        </p>
      )}

      <section className="rounded-3xl neu-card p-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
          {heroLabel}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-[40px] font-light leading-none tracking-tight text-neutral-900 dark:text-white tabular-nums">
          <span>{signedHero}</span>
          <span className="text-2xl text-neutral-400 dark:text-neutral-500">₽</span>
        </p>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{mode === 'all' ? 'Разница между поступлениями и расходами' : mode === 'income' ? 'Поступления за выбранный период' : 'Покупки и платежи за выбранный период'}</p>

        {periodMode === 'month' && <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
            {mode !== 'expense' && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Доходы
              </span>
            )}
            {mode !== 'income' && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigoblue" /> Расходы
              </span>
            )}
          </div>
          {selectedPoint && chartHasData && (
            <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              <span className="font-semibold">{selectedPoint.day} {SHORT_MONTHS_RU[selectedMonth.getMonth()]}</span>
              {mode !== 'expense' && <span className="text-mint">↑ {formatCurrency(selectedPoint.income)} ₽</span>}
              {mode !== 'income' && <span className="text-indigo-500 dark:text-indigo-300">↘ {formatCurrency(selectedPoint.expenses)} ₽</span>}
            </div>
          )}
          <svg
            viewBox="0 0 320 130"
            role="img"
            aria-label={`График ${mode === 'all' ? 'доходов и расходов' : mode === 'income' ? 'доходов' : 'расходов'} за ${monthLabel}`}
            className="block h-[142px] w-full touch-pan-y select-none rounded-lg"
            onPointerMove={handleChartPointerMove}
            onPointerDown={handleChartPointerMove}
            onPointerLeave={() => setSelectedDay(null)}
          >
            <defs>
              <linearGradient id="statistics-income-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#75DDB0" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#75DDB0" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="statistics-expense-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7776EF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#7776EF" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[10, 35, 60, 85, 112].map((y) => (
              <line key={y} x1="10" y1={y} x2="310" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 5" />
            ))}
            {mode !== 'income' && periodExpenses > 0 && (
              <path d={`${expensesPath} L 310 112 L 10 112 Z`} fill="url(#statistics-expense-area-gradient)" />
            )}
            {mode === 'income' && periodIncome > 0 && (
              <path d={`${incomePath} L 310 112 L 10 112 Z`} fill="url(#statistics-income-area-gradient)" />
            )}
            {mode !== 'income' && periodExpenses > 0 && (
              <path d={expensesPath} stroke="#7776EF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            )}
            {mode !== 'expense' && periodIncome > 0 && (
              <path d={incomePath} stroke="#67CDA1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            )}
            {selectedDay !== null && selectedPoint && chartHasData && (
              <>
                <line x1={getPointX(selectedDay - 1, chartData.length)} y1="8" x2={getPointX(selectedDay - 1, chartData.length)} y2="116" stroke="currentColor" strokeOpacity="0.16" strokeDasharray="3 4" />
                {mode !== 'income' && periodExpenses > 0 && (
                  <circle cx={getPointX(selectedDay - 1, chartData.length)} cy={getPointY(selectedPoint.expenses, chartMaximum)} r="4" fill="#FFFFFF" stroke="#7776EF" strokeWidth="2.5" />
                )}
                {mode !== 'expense' && periodIncome > 0 && (
                  <circle cx={getPointX(selectedDay - 1, chartData.length)} cy={getPointY(selectedPoint.income, chartMaximum)} r="4" fill="#FFFFFF" stroke="#67CDA1" strokeWidth="2.5" />
                )}
              </>
            )}
          </svg>
          <div className="relative mt-1 h-4 text-[10px] text-neutral-400 dark:text-neutral-500">
            {monthTicks.map((day) => {
              const left = visibleDays > 1 ? ((day - 1) / (visibleDays - 1)) * 100 : 0;
              const translate = day === 1 ? 'translateX(0)' : day === visibleDays ? 'translateX(-100%)' : 'translateX(-50%)';
              return (
                <span
                  key={day}
                  className="absolute whitespace-nowrap"
                  style={{ left: `${left}%`, transform: translate }}
                >
                  {day} {SHORT_MONTHS_RU[selectedMonth.getMonth()]}
                </span>
              );
            })}
          </div>
          {!chartHasData && (
            <p className="mt-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
              Пока нет операций за этот период
            </p>
          )}
        </div>}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3" aria-label={periodMode === 'day' ? 'Итоги за день' : 'Итоги за месяц'}>
        <div className="rounded-2xl neu-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/10 dark:bg-mint/10">
              <ArrowUpRight className="h-4 w-4 text-mint" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{periodMode === 'day' ? 'Доходы за день' : 'Доходы за месяц'}</span>
          </div>
          <p className="mt-3 text-xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {formatCurrency(periodIncome)} <span className="text-sm text-neutral-400 dark:text-neutral-500">₽</span>
          </p>
        </div>
        <div className="rounded-2xl neu-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800/70">
              <ArrowDownRight className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{periodMode === 'day' ? 'Расходы за день' : 'Расходы за месяц'}</span>
          </div>
          <p className="mt-3 text-xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {formatCurrency(periodExpenses)} <span className="text-sm text-neutral-400 dark:text-neutral-500">₽</span>
          </p>
        </div>
      </section>

      <section className="mt-3 rounded-2xl neu-card p-4" aria-label="Сравнение с предыдущим периодом">
        <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          К предыдущему периоду
        </p>
        <p className="mt-2 text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
          {comparisonHeadline}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{currentComparisonLabel}</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
              {formatComparisonMetric(mode, heroAmount)} ₽
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{previousComparisonLabel}</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-neutral-600 dark:text-neutral-300">
              {formatComparisonMetric(mode, previousHeroAmount)} ₽
            </p>
          </div>
        </div>
      </section>


      {periodMode === 'month' && (
        <section className="mt-3 rounded-2xl neu-card p-4" aria-label="Изменения по категориям">
          <div className="mb-3">
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
              Что изменилось по категориям
            </h2>
            <p className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
              {previousComparisonLabel} → {currentComparisonLabel}
            </p>
          </div>

          {categoryPeriodChanges.length === 0 ? (
            <p className="py-2 text-xs text-neutral-400 dark:text-neutral-500">
              {hasCategoryPeriodData
                ? 'Суммы по категориям не изменились между периодами.'
                : 'Нет операций для сравнения по категориям в этих периодах.'}
            </p>
          ) : (
            <div className="space-y-3">
              {categoryPeriodChanges.slice(0, 3).map((change) => (
                <div key={change.key} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800/70">
                    <IconRenderer name={change.iconName} className="h-4 w-4 text-neutral-500 dark:text-neutral-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {change.name}
                    </p>
                    <p className="mt-1 text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {formatCurrency(change.previousAmount)} ₽ → {formatCurrency(change.currentAmount)} ₽
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-white">
                      {change.difference > 0 ? '+' : '−'}{formatCurrency(Math.abs(change.difference))} ₽
                    </p>
                    <p className="mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                      {mode === 'income' ? 'доходы' : 'расходы'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">{categoryTitle}</h2>
          {categoryStats.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllCategories((previous) => !previous)}
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              {showAllCategories ? 'Свернуть' : 'Все категории'}
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showAllCategories ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        {displayedCategories.length === 0 ? (
          <div className="rounded-2xl neu-card px-4 py-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800/70">
              <HelpCircle className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">Пока нет данных</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Добавьте операцию, и здесь появится разбивка по категориям.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedCategories.map((category) => {
              const isExpanded = selectedCategoryKey === category.key;
              const detailsId = `category-details-${category.key}`;

              return (
                <div
                  key={category.key}
                  className={`overflow-hidden rounded-2xl transition-colors duration-200 ${
                    isExpanded
                      ? 'neu-card'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryKey((current) => current === category.key ? null : category.key)}
                    className="w-full rounded-2xl p-2.5 text-left transition-transform active:scale-[0.995]"
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800/70">
                        <IconRenderer name={category.iconName} className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{category.name}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">{category.percent}% от всех {mode === 'income' ? 'доходов' : 'расходов'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-white">{formatCurrency(category.amount)} ₽</span>
                        <ChevronRight className={`h-4 w-4 text-neutral-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    <div className="ml-14 mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-mint to-indigoblue transition-all duration-500"
                        style={{ width: `${Math.min(100, category.percent)}%` }}
                      />
                    </div>
                  </button>

                  <div
                    id={detailsId}
                    aria-hidden={!isExpanded}
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
                      isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className={`border-t border-neutral-200/60 px-3 pb-2 pt-1 dark:border-neutral-700/60 transition-opacity duration-200 motion-reduce:transition-none ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center justify-between py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Операции</p>
                          <span className="text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">{category.transactions.length}</span>
                        </div>
                        {category.transactions.length === 0 ? (
                          <p className="px-1 py-3 text-xs text-neutral-400 dark:text-neutral-500">Нет операций в выбранном периоде.</p>
                        ) : (
                          <div className="divide-y divide-neutral-100/80 dark:divide-neutral-800/80">
                            {category.transactions.map((transaction) => {
                              const dateISO = resolveTransactionDateISO(transaction);
                              return (
                                <button
                                  key={transaction.id}
                                  type="button"
                                  tabIndex={isExpanded ? 0 : -1}
                                  onClick={() => onSelectTransaction(transaction)}
                                  className="flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-neutral-50 active:scale-[0.995] dark:hover:bg-neutral-900/40"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{transaction.title || category.name}</p>
                                    <p className="mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">{dateISO ? formatISODateShort(dateISO) : transaction.date}</p>
                                  </div>
                                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.isIncome ? 'text-mint' : 'text-neutral-900 dark:text-white'}`}>
                                    {transaction.isIncome ? '+' : '−'}{formatCurrency(transaction.amount)} ₽
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="h-4" />
    </div>
  );
}

