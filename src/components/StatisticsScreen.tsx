import { useMemo, useState, type PointerEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { IconRenderer } from '@/components/IconRenderer';
import { MonthPicker } from '@/components/MonthPicker';
import { formatCurrency, type Transaction } from '@/data/mockData';
import { formatISODateShort, resolveTransactionDateISO } from '@/data/transactionDates';
import type { CustomCategory } from '@/hooks/useCategories';

type ViewMode = 'all' | 'income' | 'expense';

type DailyPoint = {
  day: number;
  income: number;
  expenses: number;
};

type CategoryStat = {
  key: string;
  name: string;
  iconName: string;
  amount: number;
  percent: number;
  transactions: Transaction[];
};

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const SHORT_MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

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

function getCategoryKey(transaction: Transaction): string {
  return transaction.categoryId ?? `legacy:${transaction.category.trim().toLocaleLowerCase('ru-RU')}`;
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
  const [mode, setMode] = useState<ViewMode>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const selectedMonthKey = getMonthKey(selectedMonth);
  const isCurrentMonth = currentMonthKey === selectedMonthKey;
  const monthDays = getDaysInMonth(selectedMonth);
  const visibleDays = isCurrentMonth ? now.getDate() : monthDays;
  const monthLabel = `${MONTHS_RU[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;

  const periodTransactions = useMemo(() => {
    const prefix = selectedMonthKey;
    return transactions.filter((transaction) => {
      if (transaction.isTransfer) return false;
      const isoDate = resolveTransactionDateISO(transaction);
      return Boolean(isoDate && isoDate.startsWith(prefix));
    });
  }, [transactions, selectedMonthKey]);

  const periodIncome = useMemo(
    () => periodTransactions.reduce((sum, transaction) => sum + (transaction.isIncome ? transaction.amount : 0), 0),
    [periodTransactions]
  );
  const periodExpenses = useMemo(
    () => periodTransactions.reduce((sum, transaction) => sum + (!transaction.isIncome ? transaction.amount : 0), 0),
    [periodTransactions]
  );
  const netPeriodTotal = periodIncome - periodExpenses;

  const chartData = useMemo<DailyPoint[]>(() => {
    const days = Array.from({ length: visibleDays }, (_, index) => ({
      day: index + 1,
      income: 0,
      expenses: 0,
    }));

    periodTransactions.forEach((transaction) => {
      const isoDate = resolveTransactionDateISO(transaction);
      if (!isoDate) return;
      const day = Number(isoDate.slice(8, 10));
      const point = days[day - 1];
      if (!point) return;
      if (transaction.isIncome) point.income += transaction.amount;
      else point.expenses += transaction.amount;
    });

    return days;
  }, [periodTransactions, visibleDays]);

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

  const categoryStats = useMemo<CategoryStat[]>(() => {
    const relevantTransactions = periodTransactions.filter((transaction) => {
      if (mode === 'income') return transaction.isIncome;
      // The combined view uses spending categories; the income total remains visible above.
      return !transaction.isIncome;
    });
    const groups = new Map<string, Omit<CategoryStat, 'percent'>>();

    relevantTransactions.forEach((transaction) => {
      const key = getCategoryKey(transaction);
      const linkedCategory = categories.find((category) => category.id === transaction.categoryId);
      const existing = groups.get(key);
      if (existing) {
        existing.amount += transaction.amount;
        existing.transactions.push(transaction);
      } else {
        groups.set(key, {
          key,
          name: linkedCategory?.name ?? (transaction.category || 'Без категории'),
          iconName: linkedCategory?.iconName ?? transaction.categoryIconName ?? 'HelpCircle',
          amount: transaction.amount,
          transactions: [transaction],
        });
      }
    });

    const denominator = mode === 'income' ? periodIncome : periodExpenses;
    return [...groups.values()]
      .map((group) => ({
        ...group,
        percent: denominator > 0 ? Math.round((group.amount / denominator) * 100) : 0,
        transactions: group.transactions.sort((a, b) => {
          const aDate = resolveTransactionDateISO(a) ?? '';
          const bDate = resolveTransactionDateISO(b) ?? '';
          return bDate.localeCompare(aDate) || b.id - a.id;
        }),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, categories, mode, periodIncome, periodExpenses]);

  const displayedCategories = showAllCategories ? categoryStats : categoryStats.slice(0, 5);
  const heroLabel = mode === 'all'
    ? `Итог за ${MONTHS_RU[selectedMonth.getMonth()].toLocaleLowerCase('ru-RU')}`
    : mode === 'income'
      ? `Доходы за ${MONTHS_RU[selectedMonth.getMonth()].toLocaleLowerCase('ru-RU')}`
      : `Расходы за ${MONTHS_RU[selectedMonth.getMonth()].toLocaleLowerCase('ru-RU')}`;
  const heroAmount = mode === 'all' ? netPeriodTotal : mode === 'income' ? periodIncome : periodExpenses;
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

  const selectMode = (nextMode: ViewMode) => {
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
          <MonthPicker
            label={monthLabel}
            onPrevious={() => moveMonth(-1)}
            onNext={() => moveMonth(1)}
            canGoNext={!isCurrentMonth}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-neutral-100/80 p-1 dark:bg-neutral-800/70">
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
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{mode === 'all' ? 'Разница между поступлениями и расходами' : mode === 'income' ? 'Поступления за выбранный период' : 'Покупки и платежи за выбранный период'}</p>

        <div className="mt-5">
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
              {mode !== 'expense' && <span className="text-emerald-600 dark:text-mint">↑ {formatCurrency(selectedPoint.income)} ₽</span>}
              {mode !== 'income' && <span>↘ {formatCurrency(selectedPoint.expenses)} ₽</span>}
            </div>
          )}
          <svg
            viewBox="0 0 320 130"
            role="img"
            aria-label={`График ${mode === 'all' ? 'доходов и расходов' : mode === 'income' ? 'доходов' : 'расходов'} за ${monthLabel}`}
            className="block h-[142px] w-full touch-pan-y select-none"
            onPointerMove={handleChartPointerMove}
            onPointerLeave={() => setSelectedDay(null)}
          >
            <defs>
              <linearGradient id="statistics-line-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#73DDAA" />
                <stop offset="100%" stopColor="#7776EF" />
              </linearGradient>
              <linearGradient id="statistics-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#75DDB0" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#75DDB0" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[10, 35, 60, 85, 112].map((y) => (
              <line key={y} x1="10" y1={y} x2="310" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 5" />
            ))}
            {mode !== 'income' && periodExpenses > 0 && (
              <path d={`${expensesPath} L 310 112 L 10 112 Z`} fill="url(#statistics-area-gradient)" />
            )}
            {mode === 'income' && periodIncome > 0 && (
              <path d={`${incomePath} L 310 112 L 10 112 Z`} fill="url(#statistics-area-gradient)" />
            )}
            {mode !== 'income' && periodExpenses > 0 && (
              <path d={expensesPath} stroke="url(#statistics-line-gradient)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
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
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl neu-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/10 dark:bg-mint/10">
              <ArrowUpRight className="h-4 w-4 text-mint" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Доход</span>
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
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Расход</span>
          </div>
          <p className="mt-3 text-xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {formatCurrency(periodExpenses)} <span className="text-sm text-neutral-400 dark:text-neutral-500">₽</span>
          </p>
        </div>
      </section>

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

