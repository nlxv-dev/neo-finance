import { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Download,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import type { Transaction } from '@/data/mockData';
import { formatCurrency } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import { IconRenderer } from '@/components/IconRenderer';
import {
  type PeriodType,
  type DateRange,
  getPeriodDateRange,
  getPreviousPeriodDateRange,
  filterTransactionsByDateRange,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateSavings,
  calculateCategoryBreakdown,
  calculatePercentageChange,
  toISODateString,
} from '@/utils/financialMath';
import { resolveTransactionDateISO } from '@/data/transactionDates';

import type { Account } from '@/data/accounts';

interface ReportsScreenProps {
  transactions: Transaction[];
  categories: CustomCategory[];
  accounts?: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  'current-month': 'Этот месяц',
  'previous-month': 'Прошлый месяц',
  'last-7-days': '7 дней',
  'last-30-days': '30 дней',
  'current-year': 'Этот год',
  'custom': 'Свой период',
};

const CHART_COLORS = [
  '#4ADE80', // mint
  '#6366F1', // indigoblue
  '#3B82F6', // cobalt
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // purple
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
  '#64748B', // slate
];

const MONTH_NAMES_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

export function ReportsScreen({
  transactions,
  categories,
  onSelectTransaction,
}: ReportsScreenProps) {
  const [period, setPeriod] = useState<PeriodType>('current-month');
  const [customRange, setCustomRange] = useState<DateRange>(() => getPeriodDateRange('current-month'));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Active Date Range
  const dateRange = useMemo<DateRange>(() => {
    if (period === 'custom') return customRange;
    return getPeriodDateRange(period);
  }, [period, customRange]);

  // Previous Period Date Range (for comparison)
  const previousRange = useMemo<DateRange>(() => {
    return getPreviousPeriodDateRange(dateRange);
  }, [dateRange]);

  // Current period transactions
  const currentPeriodTx = useMemo(
    () => filterTransactionsByDateRange(transactions, dateRange),
    [transactions, dateRange]
  );

  // Previous period transactions
  const previousPeriodTx = useMemo(
    () => filterTransactionsByDateRange(transactions, previousRange),
    [transactions, previousRange]
  );

  // Financial aggregates for current period
  const totalIncome = useMemo(() => calculateTotalIncome(currentPeriodTx), [currentPeriodTx]);
  const totalExpenses = useMemo(() => calculateTotalExpenses(currentPeriodTx), [currentPeriodTx]);
  const netCashFlow = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);
  const { savingsAmount, savingsRate } = useMemo(
    () => calculateSavings(totalIncome, totalExpenses),
    [totalIncome, totalExpenses]
  );

  // Financial aggregates for previous period
  const prevIncome = useMemo(() => calculateTotalIncome(previousPeriodTx), [previousPeriodTx]);
  const prevExpenses = useMemo(() => calculateTotalExpenses(previousPeriodTx), [previousPeriodTx]);
  const prevNet = useMemo(() => prevIncome - prevExpenses, [prevIncome, prevExpenses]);

  // Percentage changes
  const incomeChange = useMemo(() => calculatePercentageChange(totalIncome, prevIncome), [totalIncome, prevIncome]);
  const expenseChange = useMemo(() => calculatePercentageChange(totalExpenses, prevExpenses), [totalExpenses, prevExpenses]);
  const netChange = useMemo(() => calculatePercentageChange(netCashFlow, prevNet), [netCashFlow, prevNet]);

  // Category breakdowns
  const expenseBreakdown = useMemo(
    () => calculateCategoryBreakdown(currentPeriodTx, categories, false),
    [currentPeriodTx, categories]
  );
  const incomeBreakdown = useMemo(
    () => calculateCategoryBreakdown(currentPeriodTx, categories, true),
    [currentPeriodTx, categories]
  );
  const activeBreakdown = categoryType === 'expense' ? expenseBreakdown : incomeBreakdown;
  const activeTotal = categoryType === 'expense' ? totalExpenses : totalIncome;

  // Selected category in donut
  const selectedCategoryItem = useMemo(() => {
    if (!activeCategoryKey) return null;
    return activeBreakdown.find((item) => item.key === activeCategoryKey) ?? null;
  }, [activeCategoryKey, activeBreakdown]);

  // Time-series grouping for Income vs. Expenses Bar Chart
  const timeSeriesBars = useMemo(() => {
    if (period === 'current-year') {
      // Group by 12 months
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: MONTH_NAMES_SHORT[i],
        income: 0,
        expenses: 0,
      }));

      const yearStr = dateRange.startISO.slice(0, 4);
      currentPeriodTx.forEach((tx) => {
        if (tx.isTransfer) return;
        const iso = resolveTransactionDateISO(tx);
        if (!iso || !iso.startsWith(yearStr)) return;
        const m = parseInt(iso.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          if (tx.isIncome) months[m].income += tx.amount;
          else months[m].expenses += tx.amount;
        }
      });

      return months;
    }

    if (period === 'last-7-days') {
      // 7 individual days
      const days: Array<{ label: string; income: number; expenses: number; fullDate: string }> = [];
      const start = new Date(dateRange.startISO);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const iso = toISODateString(d);
        days.push({
          label: `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`,
          income: 0,
          expenses: 0,
          fullDate: iso,
        });
      }

      currentPeriodTx.forEach((tx) => {
        if (tx.isTransfer) return;
        const iso = resolveTransactionDateISO(tx);
        if (!iso) return;
        const match = days.find((d) => d.fullDate === iso);
        if (match) {
          if (tx.isIncome) match.income += tx.amount;
          else match.expenses += tx.amount;
        }
      });

      return days;
    }

    // Default: Group into 4-6 intervals (weeks or buckets)
    const start = new Date(dateRange.startISO);
    const end = new Date(dateRange.endISO);
    const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const bucketCount = Math.min(6, Math.max(3, Math.ceil(daysTotal / 6)));
    const bucketSize = Math.ceil(daysTotal / bucketCount);

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bStart = new Date(start);
      bStart.setDate(bStart.getDate() + i * bucketSize);
      const bEnd = new Date(start);
      bEnd.setDate(Math.min(end.getDate(), bStart.getDate() + bucketSize - 1));
      return {
        label: `${bStart.getDate()}-${bEnd.getDate()} ${MONTH_NAMES_SHORT[bEnd.getMonth()]}`,
        startISO: toISODateString(bStart),
        endISO: toISODateString(bEnd),
        income: 0,
        expenses: 0,
      };
    });

    currentPeriodTx.forEach((tx) => {
      if (tx.isTransfer) return;
      const iso = resolveTransactionDateISO(tx);
      if (!iso) return;
      const match = buckets.find((b) => iso >= b.startISO && iso <= b.endISO);
      if (match) {
        if (tx.isIncome) match.income += tx.amount;
        else match.expenses += tx.amount;
      }
    });

    return buckets;
  }, [currentPeriodTx, dateRange, period]);

  // Maximum value for bar chart scaling
  const maxBarValue = useMemo(() => {
    let max = 0;
    timeSeriesBars.forEach((b) => {
      if (b.income > max) max = b.income;
      if (b.expenses > max) max = b.expenses;
    });
    return Math.max(100, max * 1.15);
  }, [timeSeriesBars]);

  // Donut chart stroke segments
  const donutSegments = useMemo(() => {
    if (activeTotal <= 0) return [];
    let accumulatedAngle = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    return activeBreakdown.slice(0, 8).map((item, index) => {
      const slicePercent = item.amount / activeTotal;
      const strokeDash = slicePercent * circumference;
      const strokeDashoffset = -accumulatedAngle * circumference;
      accumulatedAngle += slicePercent;
      const color = CHART_COLORS[index % CHART_COLORS.length];

      return {
        key: item.key,
        name: item.name,
        amount: item.amount,
        percent: item.percent,
        strokeDash: `${strokeDash} ${circumference}`,
        strokeDashoffset,
        color,
      };
    });
  }, [activeBreakdown, activeTotal]);

  // CSV Export for Report
  const handleExportCsv = () => {
    const rows = [
      ['Neo Finance - Аналитический отчёт'],
      [`Период: ${dateRange.startISO} - ${dateRange.endISO}`],
      [`Всего доходов: ${totalIncome} RUB`],
      [`Всего расходов: ${totalExpenses} RUB`],
      [`Чистый денежный поток: ${netCashFlow} RUB`],
      [`Норма сбережений: ${savingsRate}%`],
      [''],
      ['Категория', 'Тип', 'Сумма (RUB)', 'Доля (%)', 'Количество операций'],
      ...expenseBreakdown.map((item) => [item.name, 'Расход', String(item.amount), `${item.percent}%`, String(item.count)]),
      ...incomeBreakdown.map((item) => [item.name, 'Доход', String(item.amount), `${item.percent}%`, String(item.count)]),
      [''],
      ['ID', 'Дата', 'Тип', 'Категория', 'Сумма (RUB)', 'Описание'],
      ...currentPeriodTx.map((tx) => [
        String(tx.id),
        tx.date,
        tx.isTransfer ? 'Перевод' : tx.isIncome ? 'Доход' : 'Расход',
        tx.category,
        String(tx.amount),
        tx.title || '',
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neo-finance-report-${dateRange.startISO}_${dateRange.endISO}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-5 pt-12 pb-12 animate-fade-in">
      {/* Top Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
              Отчёты и аналитика
            </h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              {dateRange.startISO} — {dateRange.endISO}
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-full neu-card-sm px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition-all active:scale-95 hover:text-mint dark:text-neutral-200"
            title="Экспорт отчёта в CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Экспорт</span>
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar py-1">
          {(['current-month', 'previous-month', 'last-7-days', 'last-30-days', 'current-year', 'custom'] as const).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                  if (p === 'custom') setShowCustomPicker(true);
                  else setShowCustomPicker(false);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  period === p
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'neu-inset text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            )
          )}
        </div>

        {/* Custom Date Range Picker Accordion */}
        {showCustomPicker && period === 'custom' && (
          <div className="mt-3 rounded-2xl neu-inset p-3 animate-slide-up">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] uppercase text-neutral-400 font-semibold mb-1">
                  С даты
                </label>
                <input
                  type="date"
                  value={customRange.startISO}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, startISO: e.target.value }))}
                  className="w-full rounded-xl bg-white p-2 text-xs text-neutral-900 outline-none dark:bg-neutral-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-neutral-400 font-semibold mb-1">
                  По дату
                </label>
                <input
                  type="date"
                  value={customRange.endISO}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, endISO: e.target.value }))}
                  className="w-full rounded-xl bg-white p-2 text-xs text-neutral-900 outline-none dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main KPI Overview Cards */}
      <section className="mb-6 grid grid-cols-2 gap-3">
        {/* Income Card */}
        <div className="rounded-3xl neu-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Доходы
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-mint/15 text-mint">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {formatCurrency(totalIncome)} <span className="text-sm text-neutral-400">₽</span>
          </p>
          {incomeChange !== null && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
              {incomeChange >= 0 ? (
                <span className="text-mint flex items-center">
                  +{incomeChange}% к пред.
                </span>
              ) : (
                <span className="text-red-500 flex items-center">
                  {incomeChange}% к пред.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expenses Card */}
        <div className="rounded-3xl neu-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Расходы
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500/10 text-red-500 dark:text-red-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {formatCurrency(totalExpenses)} <span className="text-sm text-neutral-400">₽</span>
          </p>
          {expenseChange !== null && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
              {expenseChange <= 0 ? (
                <span className="text-mint flex items-center">
                  {expenseChange}% к пред.
                </span>
              ) : (
                <span className="text-red-500 flex items-center">
                  +{expenseChange}% к пред.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Net Cash Flow Card */}
        <div className="rounded-3xl neu-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Чистый поток
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigoblue/15 text-indigoblue">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-2 text-2xl font-light tracking-tight tabular-nums ${
              netCashFlow > 0
                ? 'text-mint'
                : netCashFlow < 0
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-neutral-900 dark:text-white'
            }`}
          >
            {netCashFlow > 0 ? '+' : ''}{formatCurrency(netCashFlow)}{' '}
            <span className="text-sm text-neutral-400">₽</span>
          </p>
          {netChange !== null ? (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
              <span className={netChange >= 0 ? 'text-mint' : 'text-red-500'}>
                {netChange >= 0 ? `+${netChange}%` : `${netChange}%`} к пред.
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
              {netCashFlow >= 0 ? 'Профицит бюджета' : 'Дефицит средств'}
            </p>
          )}
        </div>

        {/* Savings Rate Card */}
        <div className="rounded-3xl neu-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Сбережения
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cobalt/15 text-cobalt">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {savingsRate}%
          </p>
          <p className="mt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
            {formatCurrency(Math.max(0, savingsAmount))} ₽ сохранено
          </p>
        </div>
      </section>

      {/* Income vs Expenses Bar Chart */}
      <section className="mb-6 rounded-3xl neu-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Доходы и расходы во времени
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Сравнение денежных потоков по интервалам
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-mint" /> Доход
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigoblue" /> Расход
            </span>
          </div>
        </div>

        {/* Interactive Bar Chart SVG */}
        {timeSeriesBars.length === 0 || (totalIncome === 0 && totalExpenses === 0) ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            Нет данных для отображения за выбранный период
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex h-44 items-end gap-2 pt-6 pb-2">
              {timeSeriesBars.map((bar, idx) => {
                const incomeH = Math.max(4, (bar.income / maxBarValue) * 100);
                const expenseH = Math.max(4, (bar.expenses / maxBarValue) * 100);
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={idx}
                    className="flex flex-1 flex-col items-center h-full justify-end group cursor-pointer relative"
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    onClick={() => setHoveredBarIndex((prev) => (prev === idx ? null : idx))}
                  >
                    {/* Tooltip on hover/touch */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 whitespace-nowrap rounded-xl bg-neutral-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg dark:bg-white dark:text-neutral-900">
                        <p className="font-semibold">{bar.label}</p>
                        <p className="text-mint">↑ +{formatCurrency(bar.income)} ₽</p>
                        <p className="text-indigoblue">↓ −{formatCurrency(bar.expenses)} ₽</p>
                      </div>
                    )}

                    {/* Dual Bars */}
                    <div className="flex items-end gap-1 w-full justify-center max-w-[28px] h-full">
                      {/* Income Bar */}
                      <div
                        className="w-1/2 rounded-t-md bg-mint transition-all duration-300"
                        style={{ height: `${bar.income > 0 ? incomeH : 4}%`, opacity: bar.income > 0 ? 1 : 0.2 }}
                      />
                      {/* Expense Bar */}
                      <div
                        className="w-1/2 rounded-t-md bg-indigoblue transition-all duration-300"
                        style={{ height: `${bar.expenses > 0 ? expenseH : 4}%`, opacity: bar.expenses > 0 ? 1 : 0.2 }}
                      />
                    </div>

                    {/* X-axis Label */}
                    <span className="mt-2 text-[9px] text-neutral-400 dark:text-neutral-500 truncate max-w-full text-center">
                      {bar.label.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Category Breakdown & Donut Chart Section */}
      <section className="mb-6 rounded-3xl neu-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Структура категорий
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Распределение {categoryType === 'expense' ? 'расходов' : 'доходов'}
            </p>
          </div>

          {/* Toggle Expense / Income */}
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => {
                setCategoryType('expense');
                setActiveCategoryKey(null);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                categoryType === 'expense'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              Расходы
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoryType('income');
                setActiveCategoryKey(null);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                categoryType === 'income'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              Доходы
            </button>
          </div>
        </div>

        {activeBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            Нет данных по категориям за этот период
          </div>
        ) : (
          <div>
            {/* Donut Chart Display */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
              <div className="relative flex h-48 w-48 items-center justify-center shrink-0">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-neutral-100 dark:text-neutral-800"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.key}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={activeCategoryKey === seg.key ? '14' : '11'}
                      strokeDasharray={seg.strokeDash}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-300 cursor-pointer"
                      onClick={() => setActiveCategoryKey((prev) => (prev === seg.key ? null : seg.key))}
                    />
                  ))}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 truncate max-w-[110px]">
                    {selectedCategoryItem ? selectedCategoryItem.name : 'Всего'}
                  </span>
                  <span className="text-base font-semibold text-neutral-900 dark:text-white tabular-nums">
                    {formatCurrency(selectedCategoryItem ? selectedCategoryItem.amount : activeTotal)} ₽
                  </span>
                  {selectedCategoryItem && (
                    <span className="text-[10px] text-mint font-medium">
                      {selectedCategoryItem.percent}%
                    </span>
                  )}
                </div>
              </div>

              {/* Top Categories Mini Legend */}
              <div className="flex-1 w-full space-y-1.5">
                {donutSegments.slice(0, 5).map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => setActiveCategoryKey((prev) => (prev === seg.key ? null : seg.key))}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                      activeCategoryKey === seg.key
                        ? 'bg-neutral-100 dark:bg-neutral-800'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="truncate text-neutral-700 dark:text-neutral-200">{seg.name}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums shrink-0">
                      <span className="text-neutral-400">{seg.percent}%</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{formatCurrency(seg.amount)} ₽</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ranked Category List with Progress Bars */}
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <h3 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                Все категории по рейтингу ({activeBreakdown.length})
              </h3>

              {activeBreakdown.map((item, index) => {
                const isSelected = activeCategoryKey === item.key;
                const color = CHART_COLORS[index % CHART_COLORS.length];

                return (
                  <div
                    key={item.key}
                    onClick={() => setActiveCategoryKey((prev) => (prev === item.key ? null : item.key))}
                    className={`rounded-2xl p-3 transition-all cursor-pointer ${
                      isSelected ? 'neu-card ring-1 ring-mint' : 'neu-card-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl neu-inset">
                          <IconRenderer name={item.iconName} className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            {item.count} {item.count === 1 ? 'операция' : item.count < 5 ? 'операции' : 'операций'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-white">
                          {formatCurrency(item.amount)} ₽
                        </span>
                        <p className="text-[10px] font-medium text-neutral-400">
                          {item.percent}%
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, item.percent)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Period Transactions List */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Операции за период
          </h2>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {currentPeriodTx.length} оп.
          </span>
        </div>

        {currentPeriodTx.length === 0 ? (
          <div className="rounded-2xl neu-card px-4 py-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Нет операций в этом периоде
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              Выберите другой диапазон дат или добавьте транзакции
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentPeriodTx.map((tx) => {
              const isIncome = tx.isIncome;
              const isTransfer = tx.isTransfer;

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectTransaction?.(tx)}
                  className="flex w-full items-center gap-3 rounded-2xl neu-card-sm p-3 text-left transition-transform active:scale-[0.98]"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isTransfer
                        ? 'bg-indigoblue/15 text-indigoblue'
                        : isIncome
                          ? 'bg-mint/15 text-mint'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    <IconRenderer
                      name={isTransfer ? 'ArrowLeftRight' : tx.categoryIconName || 'HelpCircle'}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {tx.title || tx.category}
                    </p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {tx.category} · {tx.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        isTransfer
                          ? 'text-indigoblue'
                          : isIncome
                            ? 'text-mint'
                            : 'text-neutral-900 dark:text-white'
                      }`}
                    >
                      {isTransfer ? '' : isIncome ? '+' : '−'}
                      {formatCurrency(tx.amount)} ₽
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
