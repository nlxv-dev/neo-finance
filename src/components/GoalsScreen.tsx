import { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  Pencil,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { Goal, GoalInput } from '@/data/goals';
import {
  GOAL_COLORS,
  getGoalRemaining,
  getGoalProgressPercent,
  getMonthlyRecommendation,
} from '@/data/goals';
import type { Account } from '@/data/accounts';
import { formatCurrency } from '@/data/mockData';
import { IconRenderer } from '@/components/IconRenderer';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import { GoalDepositSheet } from '@/components/GoalDepositSheet';

interface GoalsScreenProps {
  goals: Goal[];
  accounts: Account[];
  onAddGoal: (data: GoalInput) => void;
  onUpdateGoal: (id: string, updates: Partial<GoalInput>) => void;
  onDeleteGoal: (id: string) => void;
  onDepositToGoal: (id: string, amount: number, sourceAccountId?: string | null) => void;
  onWithdrawFromGoal: (id: string, amount: number, destinationAccountId?: string | null) => void;
}

type FilterTab = 'all' | 'active' | 'completed';

export function GoalsScreen({
  goals,
  accounts,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onDepositToGoal,
  onWithdrawFromGoal,
}: GoalsScreenProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);

  // Aggregate metrics
  const totalSaved = useMemo(() => goals.reduce((sum, g) => sum + g.currentAmount, 0), [goals]);
  const totalTarget = useMemo(() => goals.reduce((sum, g) => sum + g.targetAmount, 0), [goals]);
  const overallProgress = useMemo(
    () => (totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0),
    [totalSaved, totalTarget]
  );
  const activeCount = useMemo(() => goals.filter((g) => !g.isReached).length, [goals]);
  const completedCount = useMemo(() => goals.filter((g) => g.isReached).length, [goals]);

  // Filtered list
  const filteredGoals = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => !g.isReached);
    if (filter === 'completed') return goals.filter((g) => g.isReached);
    return goals;
  }, [goals, filter]);

  const getColorMeta = (colorId: string) => {
    return GOAL_COLORS.find((c) => c.id === colorId) || GOAL_COLORS[0];
  };

  const formatDeadlineDate = (isoStr?: string) => {
    if (!isoStr) return null;
    try {
      const date = new Date(isoStr);
      const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* === HEADER SECTION === */}
      <div className="px-5 pt-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Накопления и планы
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <span>Финансовые цели</span>
              <Target className="h-5 w-5 text-mint" />
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 gpu"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Новая цель</span>
          </button>
        </div>

        {/* Total Progress Card */}
        <div className="mt-5 rounded-3xl neu-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Всего накоплено в целях
            </span>
            <div className="flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint">
              <Sparkles className="h-3 w-3" />
              <span>{overallProgress}%</span>
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-light tracking-tight text-neutral-900 dark:text-white">
              <AnimatedCounter value={totalSaved} />
            </span>
            <span className="text-lg text-neutral-400">₽</span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              из {formatCurrency(totalTarget)} ₽
            </span>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mint via-teal-400 to-indigoblue transition-all duration-1000 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Quick telemetry stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 dark:border-neutral-800/60 pt-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigoblue/15 text-indigoblue">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-400">В процессе</p>
                <p className="text-xs font-semibold text-neutral-900 dark:text-white">{activeCount} цели</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-mint/15 text-mint">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-400">Достигнуто</p>
                <p className="text-xs font-semibold text-neutral-900 dark:text-white">{completedCount} целей</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === FILTER PILLS === */}
      <div className="px-5">
        <div className="flex items-center gap-2 rounded-2xl neu-inset p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            Все ({goals.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all ${
              filter === 'active'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            В процессе ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all ${
              filter === 'completed'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            Достигнуто ({completedCount})
          </button>
        </div>
      </div>

      {/* === GOALS CARDS LIST === */}
      <div className="px-5 space-y-4">
        {filteredGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl neu-card p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl neu-inset text-neutral-400">
              <Target className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {filter === 'completed'
                ? 'Пока нет достигнутых целей'
                : filter === 'active'
                  ? 'Нет активных целей'
                  : 'Список целей пуст'}
            </h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-xs">
              Сформулируйте мечту или крупную покупку, и отслеживайте каждый шаг к её осуществлению!
            </p>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="mt-4 flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Создать первую цель</span>
            </button>
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const progress = getGoalProgressPercent(goal);
            const remaining = getGoalRemaining(goal);
            const monthlyRec = getMonthlyRecommendation(goal);
            const colorMeta = getColorMeta(goal.color);
            const formattedDeadline = formatDeadlineDate(goal.deadline);
            const linkedAccount = accounts.find((a) => a.id === goal.accountId);

            return (
              <div
                key={goal.id}
                className="relative overflow-hidden rounded-3xl neu-card p-5 transition-transform active:scale-[0.99] gpu"
              >
                {/* Top card row: icon, title, edit */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorMeta.gradient} text-white shadow-sm`}
                    >
                      <IconRenderer name={goal.iconName} className="h-6 w-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-semibold text-neutral-900 dark:text-white truncate">
                          {goal.name}
                        </h3>
                        {goal.isReached && (
                          <CheckCircle2 className="h-4 w-4 text-mint shrink-0" strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                        {formattedDeadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formattedDeadline}</span>
                          </span>
                        )}
                        {linkedAccount && (
                          <span className="flex items-center gap-1 truncate text-neutral-500 dark:text-neutral-400">
                            <Layers className="h-3 w-3 shrink-0" />
                            <span className="truncate">{linkedAccount.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingGoal(goal)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl neu-inset text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-all active:scale-90"
                    aria-label="Редактировать цель"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Progress amounts & percentage */}
                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                      {formatCurrency(goal.currentAmount)} ₽
                    </span>
                    <span className="ml-1 text-xs text-neutral-400">
                      / {formatCurrency(goal.targetAmount)} ₽
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      goal.isReached
                        ? 'bg-mint/15 text-mint'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {progress}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${colorMeta.gradient} transition-all duration-700 ease-out`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Status or monthly recommendation */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
                  {goal.isReached ? (
                    <span className="flex items-center gap-1 text-mint font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      Цель успешно достигнута!
                    </span>
                  ) : (
                    <span>Осталось накопить: <strong className="text-neutral-700 dark:text-neutral-200">{formatCurrency(remaining)} ₽</strong></span>
                  )}

                  {monthlyRec !== null && monthlyRec > 0 && !goal.isReached && (
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      ~{formatCurrency(monthlyRec)} ₽/мес
                    </span>
                  )}
                </div>

                {/* Card Action: Quick Top-up Button */}
                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDepositGoal(goal)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-mint hover:underline active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span>Пополнить или изменить баланс</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingGoal(goal)}
                    className="flex items-center gap-0.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  >
                    <span>Подробнее</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sheet: Add Goal */}
      <GoalEditSheet
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        goal={null}
        accounts={accounts}
        onSave={onAddGoal}
      />

      {/* Sheet: Edit Goal */}
      <GoalEditSheet
        open={editingGoal !== null}
        onClose={() => setEditingGoal(null)}
        goal={editingGoal}
        accounts={accounts}
        onSave={(data) => {
          if (editingGoal) onUpdateGoal(editingGoal.id, data);
        }}
        onDelete={(id) => onDeleteGoal(id)}
      />

      {/* Sheet: Deposit / Withdraw from Goal */}
      <GoalDepositSheet
        open={depositGoal !== null}
        onClose={() => setDepositGoal(null)}
        goal={depositGoal}
        accounts={accounts}
        onDeposit={onDepositToGoal}
        onWithdraw={onWithdrawFromGoal}
      />
    </div>
  );
}
