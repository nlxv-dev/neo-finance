import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleHelp, Clock3, Pencil, Plus, Target, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import { GoalProgressSheet } from '@/components/GoalProgressSheet';
import { IconRenderer } from '@/components/IconRenderer';
import { formatCurrency } from '@/data/mockData';
import {
  formatGoalDeadline,
  getGoalProgressPercent,
  getGoalRemaining,
  getMonthlyRecommendation,
  GOAL_COLORS,
  isGoalCompleted,
  type Goal,
  type GoalInput,
} from '@/data/goals';

interface GoalsScreenProps {
  goals: Goal[];
  totalSaved: number;
  totalTarget: number;
  overallProgress: number;
  activeCount: number;
  completedCount: number;
  canWrite: boolean;
  onAddGoal: (input: GoalInput) => boolean;
  onUpdateGoal: (id: string, updates: Partial<GoalInput>) => boolean;
  onDeleteGoal: (id: string) => boolean;
  onAddProgress: (id: string, amount: number) => boolean;
  onReduceProgress: (id: string, amount: number) => boolean;
}

type GoalFilter = 'all' | 'active' | 'completed';

function isDeadlinePassed(deadline?: string): boolean {
  if (!deadline) return false;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return deadline < todayString;
}

function getGoalColor(color: Goal['color']) {
  return GOAL_COLORS.find((item) => item.id === color) ?? GOAL_COLORS[0];
}

export function GoalsScreen({
  goals,
  totalSaved,
  totalTarget,
  overallProgress,
  activeCount,
  completedCount,
  canWrite,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddProgress,
  onReduceProgress,
}: GoalsScreenProps) {
  const [filter, setFilter] = useState<GoalFilter>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [isProgressOpen, setIsProgressOpen] = useState(false);

  const filteredGoals = useMemo(() => goals.filter((goal) => {
    if (filter === 'active') return !isGoalCompleted(goal);
    if (filter === 'completed') return isGoalCompleted(goal);
    return true;
  }), [goals, filter]);

  const openCreate = () => {
    setEditingGoal(null);
    setIsEditorOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsEditorOpen(true);
  };

  const openProgress = (goal: Goal) => {
    setProgressGoal(goal);
    setIsProgressOpen(true);
  };

  return (
    <div className="px-5 pb-10 pt-12">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Планы и накопления</p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Цели <Target className="h-5 w-5 text-mint" />
            </h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={!canWrite}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-mint to-indigoblue px-3.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />Новая цель
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Отслеживайте движение к своим планам. Прогресс целей ведётся отдельно от балансов счетов.
        </p>
      </header>

      {!canWrite && (
        <div role="status" className="mb-5 rounded-2xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Хранилище целей доступно только для чтения. Сначала устраните проблему восстановления данных в уведомлении приложения.
        </div>
      )}

      <section className="mb-5 rounded-3xl neu-card p-5" aria-label="Общий прогресс целей">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Прогресс целей</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-semibold text-mint">
            <TrendingUp className="h-3.5 w-3.5" />{overallProgress}%
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-light tracking-tight tabular-nums text-neutral-900 dark:text-white"><AnimatedCounter value={totalSaved} /></span>
          <span className="text-lg font-light text-neutral-500 dark:text-neutral-400">₽</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">из {formatCurrency(totalTarget)} ₽</span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800"
          role="progressbar"
          aria-label="Общий прогресс финансовых целей"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={overallProgress}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-mint via-teal-400 to-indigoblue transition-[width] duration-300" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigoblue/15 text-indigoblue"><Clock3 className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">В процессе</p>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">{activeCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/15 text-mint"><CheckCircle2 className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Достигнуто</p>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">{completedCount}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Это сумма прогресса по целям, а не остаток на банковских счетах. Одна и та же сумма может учитываться в нескольких планах — не используйте показатель как общий капитал.
        </p>
      </section>

      <div className="mb-4 flex items-center gap-1 rounded-2xl neu-inset p-1" role="group" aria-label="Фильтр целей">
        {([
          { id: 'all', label: 'Все', count: goals.length },
          { id: 'active', label: 'В процессе', count: activeCount },
          { id: 'completed', label: 'Достигнуто', count: completedCount },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={`min-h-10 flex-1 rounded-xl px-2 text-[11px] font-medium transition-colors ${filter === item.id ? 'bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-950' : 'text-neutral-500 dark:text-neutral-300'}`}
          >
            {item.label} <span className={filter === item.id ? 'opacity-75' : 'opacity-70'}>{item.count}</span>
          </button>
        ))}
      </div>

      <section className="space-y-3" aria-label="Список финансовых целей">
        {filteredGoals.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl neu-card px-6 py-9 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl neu-inset text-neutral-500 dark:text-neutral-300"><Target className="h-7 w-7" strokeWidth={1.5} /></span>
            <h2 className="mt-4 text-sm font-semibold text-neutral-900 dark:text-white">
              {filter === 'completed' ? 'Пока нет достигнутых целей' : filter === 'active' ? 'Нет целей в процессе' : 'Цели пока не добавлены'}
            </h2>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Добавьте финансовый план — например, отпуск, крупную покупку или резерв на непредвиденные расходы.
            </p>
            {filter !== 'completed' && (
              <button type="button" onClick={openCreate} disabled={!canWrite} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 text-xs font-semibold text-white disabled:opacity-40">
                <Plus className="h-4 w-4" />Создать первую цель
              </button>
            )}
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const completed = isGoalCompleted(goal);
            const progress = getGoalProgressPercent(goal);
            const remaining = getGoalRemaining(goal);
            const color = getGoalColor(goal.color);
            const deadlineLabel = formatGoalDeadline(goal.deadline);
            const monthlyRecommendation = getMonthlyRecommendation(goal);
            const overdue = !completed && isDeadlinePassed(goal.deadline);

            return (
              <article key={goal.id} className="rounded-3xl neu-card p-4">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color.iconClass}`}>
                    <IconRenderer name={goal.iconName} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-neutral-900 dark:text-white">{goal.name}</h2>
                      {completed && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-label="Цель достигнута" />}
                      <button
                        type="button"
                        onClick={() => openEdit(goal)}
                        disabled={!canWrite}
                        aria-label={`Редактировать цель ${goal.name}`}
                        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5 disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    {goal.notes && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">{goal.notes}</p>}
                    {deadlineLabel && (
                      <p className={`mt-1.5 inline-flex items-center gap-1 text-[10px] ${overdue ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        <CalendarDays className="h-3 w-3" />{overdue ? `Срок прошёл: ${deadlineLabel}` : `Срок: ${deadlineLabel}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-lg font-medium tracking-tight tabular-nums text-neutral-900 dark:text-white">{formatCurrency(goal.currentAmount)} <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">₽</span></p>
                  <p className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">из {formatCurrency(goal.targetAmount)} ₽</p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800"
                    role="progressbar"
                    aria-label={`Прогресс цели ${goal.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <div className={`h-full rounded-full bg-gradient-to-r ${color.progressClass} transition-[width] duration-300`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">{progress}%</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {completed ? 'Цель достигнута' : `Осталось ${formatCurrency(remaining)} ₽`}
                  </span>
                  {monthlyRecommendation !== null && !completed && (
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">≈ {formatCurrency(monthlyRecommendation)} ₽/мес.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openProgress(goal)}
                  disabled={!canWrite || (completed && goal.currentAmount === 0)}
                  className="mt-4 min-h-11 w-full rounded-2xl neu-card-sm px-4 text-xs font-semibold text-neutral-700 transition-transform active:scale-[0.99] dark:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Обновить прогресс
                </button>
              </article>
            );
          })
        )}
      </section>

      <div className="mt-5 flex items-start gap-2 rounded-2xl neu-inset p-3 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Пополнение или уменьшение прогресса не создаёт транзакцию и не меняет остаток счёта. Для фактического перемещения средств используйте перевод в Кошельке.</p>
      </div>

      <GoalEditSheet
        open={isEditorOpen}
        goal={editingGoal}
        canWrite={canWrite}
        onClose={() => setIsEditorOpen(false)}
        onSave={(input: GoalInput) => editingGoal ? onUpdateGoal(editingGoal.id, input) : onAddGoal(input)}
        onDelete={onDeleteGoal}
      />
      <GoalProgressSheet
        open={isProgressOpen}
        goal={progressGoal}
        canWrite={canWrite}
        onClose={() => setIsProgressOpen(false)}
        onSave={(mode, amount) => mode === 'add'
          ? (progressGoal ? onAddProgress(progressGoal.id, amount) : false)
          : (progressGoal ? onReduceProgress(progressGoal.id, amount) : false)}
      />
    </div>
  );
}
