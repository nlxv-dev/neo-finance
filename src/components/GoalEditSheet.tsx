import { useEffect, useState } from 'react';
import { CalendarDays, Check, Trash2 } from 'lucide-react';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { DeleteConfirmationPanel } from '@/components/DeleteConfirmationPanel';
import { IconRenderer } from '@/components/IconRenderer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { GOAL_COLORS, GOAL_ICON_OPTIONS, isValidGoalDeadline, type Goal, type GoalColor, type GoalInput } from '@/data/goals';

interface GoalEditSheetProps {
  open: boolean;
  goal: Goal | null;
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: GoalInput) => boolean;
  onDelete?: (id: string) => void;
}

function todayDateInputValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

const FIELD_CLASS = 'min-h-12 w-full rounded-2xl neu-inset px-4 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-mint/50 dark:text-white';

export function GoalEditSheet({ open, goal, canWrite, onClose, onSave, onDelete }: GoalEditSheetProps) {
  const [name, setName] = useState('');
  const [targetDigits, setTargetDigits] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [iconName, setIconName] = useState<string>('PiggyBank');
  const [color, setColor] = useState<GoalColor>('mint');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setTargetDigits(goal ? String(goal.targetAmount) : '');
    setDeadline(goal?.deadline ?? '');
    setNotes(goal?.notes ?? '');
    setIconName(goal?.iconName ?? 'PiggyBank');
    setColor(goal?.color ?? 'mint');
    setKeyboardOpen(false);
    setConfirmDelete(false);
    setError('');
  }, [open, goal]);

  const handleSave = () => {
    const normalizedName = name.trim();
    const targetAmount = Number(targetDigits);
    if (!normalizedName) {
      setError('Введите название цели.');
      return;
    }
    if (normalizedName.length > 80) {
      setError('Название должно быть короче 80 символов.');
      return;
    }
    if (!Number.isSafeInteger(targetAmount) || targetAmount <= 0) {
      setError('Укажите целую сумму больше нуля.');
      return;
    }
    if (deadline && !isValidGoalDeadline(deadline)) {
      setError('Укажите корректную дату.');
      return;
    }
    if (!canWrite) {
      setError('Хранилище целей доступно только для чтения.');
      return;
    }
    const saved = onSave({
      name: normalizedName,
      targetAmount,
      iconName,
      color,
      ...(deadline ? { deadline } : {}),
      ...(notes.trim() ? { notes: notes.trim().slice(0, 300) } : {}),
    });
    if (saved) onClose();
    else setError('Не удалось сохранить цель. Проверьте данные и состояние хранилища.');
  };

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onEscape={() => (confirmDelete ? setConfirmDelete(false) : keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onBackdropClick={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onPanelClick={(event) => {
        if (!keyboardOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
        setKeyboardOpen(false);
      }}
      ariaLabel={confirmDelete ? 'Подтверждение удаления цели' : goal ? 'Редактирование цели' : 'Новая цель'}
      panelClassName="overflow-y-auto no-scrollbar"
      panelStyle={{ maxHeight: '92dvh' }}
    >
      <div className="flex flex-col px-6 pb-7">
        {confirmDelete && goal ? (
          <div className="flex min-h-64 flex-col gap-5 pt-5">
            <DeleteConfirmationPanel
              title="Удалить цель?"
              description={`Цель «${goal.name}» и её прогресс будут удалены. Счета и история транзакций не изменятся.`}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() => {
                onDelete?.(goal.id);
                onClose();
              }}
              confirmLabel="Удалить цель"
            />
          </div>
        ) : (
          <>
            <div className="mb-5 pr-9">
              <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                {goal ? 'Редактировать цель' : 'Новая цель'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Определите сумму, которую хотите отслеживать. Цель не резервирует деньги на счёте.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="goal-name" className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Название</label>
                <input
                  id="goal-name"
                  autoComplete="off"
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например, отпуск"
                  className={FIELD_CLASS}
                  disabled={!canWrite}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Целевая сумма</label>
                <div className="rounded-2xl neu-inset px-3 py-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <AmountTrigger
                      value={targetDigits}
                      onChange={(value) => setTargetDigits(value.replace(/\D/g, '').slice(0, 12))}
                      keyboardOpen={keyboardOpen}
                      onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
                      onOpenKeyboard={() => setKeyboardOpen(true)}
                      onCloseKeyboard={() => setKeyboardOpen(false)}
                      label="Целевая сумма в рублях"
                      keyboardId="goal-target-keyboard"
                      showCurrency={false}
                      showZeroPlaceholder
                    />
                    <span className="text-xl font-light text-neutral-500 dark:text-neutral-400">₽</span>
                  </div>
                </div>
              </div>

              {keyboardOpen ? (
                <div className="space-y-3 animate-fade-in">
                  <AmountKeyboard
                    id="goal-target-keyboard"
                    value={targetDigits}
                    onChange={(value) => setTargetDigits(value.replace(/\D/g, '').slice(0, 12))}
                    onClose={() => setKeyboardOpen(false)}
                    label="Целевая сумма"
                    replaceOnFirstDigit
                  />
                  <button type="button" onClick={() => setKeyboardOpen(false)} className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-mint to-indigoblue text-sm font-semibold text-white">
                    <Check className="mr-2 inline h-4 w-4" />Готово
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="goal-deadline" className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Срок (необязательно)</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        id="goal-deadline"
                        type="date"
                        min={todayDateInputValue()}
                        value={deadline}
                        onChange={(event) => setDeadline(event.target.value)}
                        className={`${FIELD_CLASS} pl-10 pr-3`}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Иконка</span>
                    <div className="grid grid-cols-5 gap-2">
                      {GOAL_ICON_OPTIONS.map((option) => (
                        <button
                          key={option.name}
                          type="button"
                          title={option.label}
                          aria-label={option.label}
                          aria-pressed={iconName === option.name}
                          onClick={() => setIconName(option.name)}
                          disabled={!canWrite}
                          className={`flex min-h-12 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${iconName === option.name ? 'bg-mint/15 text-mint ring-1 ring-mint/50' : 'neu-inset text-neutral-500 dark:text-neutral-300'}`}
                        >
                          <IconRenderer name={option.name} className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Акцент</span>
                    <div className="flex items-center gap-3">
                      {GOAL_COLORS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          title={option.label}
                          aria-label={option.label}
                          aria-pressed={color === option.id}
                          onClick={() => setColor(option.id)}
                          disabled={!canWrite}
                          className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 ${color === option.id ? 'ring-2 ring-neutral-800 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-neutral-950' : ''}`}
                        >
                          <span className={`h-6 w-6 rounded-full ${option.swatchClass}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="goal-notes" className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Заметка (необязательно)</label>
                    <textarea
                      id="goal-notes"
                      value={notes}
                      maxLength={300}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={2}
                      placeholder="Что поможет не потерять мотивацию?"
                      className={`${FIELD_CLASS} min-h-20 resize-none py-3 leading-relaxed`}
                      disabled={!canWrite}
                    />
                  </div>
                </>
              )}

              {error && <p role="alert" className="text-xs leading-relaxed text-red-500">{error}</p>}

              {!keyboardOpen && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canWrite}
                    className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 text-sm font-semibold text-white transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {goal ? 'Сохранить изменения' : 'Создать цель'}
                  </button>
                  {goal && onDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={!canWrite}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/5 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />Удалить цель
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
