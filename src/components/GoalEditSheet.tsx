import { useState, useEffect } from 'react';
import {
  X,
  Check,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';
import type { Goal, GoalInput } from '@/data/goals';
import { GOAL_COLORS } from '@/data/goals';
import type { Account } from '@/data/accounts';
import { ICON_GROUPS } from '@/data/iconsConfig';
import { IconRenderer } from '@/components/IconRenderer';
import { DeleteConfirmationPanel } from '@/components/DeleteConfirmationPanel';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';

const POPULAR_GOAL_ICONS = [
  'Target',
  'ShieldCheck',
  'Palmtree',
  'Laptop',
  'Car',
  'Home',
  'GraduationCap',
  'Plane',
  'Gift',
  'Heart',
  'Sparkles',
  'PiggyBank',
  'Coins',
  'Briefcase',
  'Camera',
  'Gamepad2',
  'BookOpen',
  'Smartphone',
];

interface GoalEditSheetProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  accounts?: Account[];
  onSave: (data: GoalInput) => void;
  onDelete?: (id: string) => void;
}

export function GoalEditSheet({
  open,
  onClose,
  goal,
  accounts = [],
  onSave,
  onDelete,
}: GoalEditSheetProps) {
  const isEditing = Boolean(goal);

  const [name, setName] = useState('');
  const [targetDigits, setTargetDigits] = useState('100000');
  const [currentDigits, setCurrentDigits] = useState('0');
  const [iconName, setIconName] = useState('Target');
  const [color, setColor] = useState('mint');
  const [deadline, setDeadline] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [keyboardField, setKeyboardField] = useState<'target' | 'current' | null>(null);
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [activeIconGroup, setActiveIconGroup] = useState<string>('Деньги');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const keyboardOpen = keyboardField !== null;

  useEffect(() => {
    if (open) {
      if (goal) {
        setName(goal.name);
        setTargetDigits(String(goal.targetAmount));
        setCurrentDigits(String(goal.currentAmount));
        setIconName(goal.iconName);
        setColor(goal.color);
        setDeadline(goal.deadline || '');
        setAccountId(goal.accountId || null);
        setNotes(goal.notes || '');
      } else {
        setName('');
        setTargetDigits('100000');
        setCurrentDigits('0');
        setIconName('Target');
        setColor('mint');
        setDeadline('');
        setAccountId(null);
        setNotes('');
      }
      setKeyboardField(null);
      setShowAllIcons(false);
      setIsDeleting(false);
      setError('');
    }
  }, [open, goal]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название цели');
      return;
    }

    const targetAmount = parseInt(targetDigits || '0', 10) || 0;
    if (targetAmount <= 0) {
      setError('Целевая сумма должна быть больше нуля');
      return;
    }

    const currentAmount = parseInt(currentDigits || '0', 10) || 0;

    onSave({
      name: trimmed,
      targetAmount,
      currentAmount,
      iconName,
      color,
      deadline: deadline ? deadline : undefined,
      accountId: accountId || null,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    onClose();
  };

  const handleDeleteConfirm = () => {
    if (goal && onDelete) {
      onDelete(goal.id);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 gpu"
        onClick={() => {
          if (keyboardOpen) setKeyboardField(null);
          else onClose();
        }}
      />

      {/* Sheet Modal */}
      <div
        onClick={(e) => {
          if (!keyboardOpen) return;
          const target = e.target as HTMLElement;
          if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
          setKeyboardField(null);
        }}
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu overflow-y-auto no-scrollbar ${
          keyboardOpen ? 'max-h-[95dvh]' : 'max-h-[90vh]'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Top Header Actions */}
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {!keyboardOpen && (
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint transition-all active:scale-95 dark:bg-mint/20 dark:text-mint"
              aria-label="Сохранить"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>{isEditing ? 'Сохранить' : 'Создать'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full neu-inset text-neutral-500 active:scale-90 dark:text-neutral-400"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col p-6 pt-2 pb-8">
          {isDeleting ? (
            <div className="py-4">
              <DeleteConfirmationPanel
                title="Удалить финансовую цель?"
                description={`Вы уверены, что хотите удалить цель «${goal?.name}»? Накопленный прогресс будет сброшен.`}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setIsDeleting(false)}
                confirmLabel="Удалить цель"
              />
            </div>
          ) : (
            <>
              {/* Header Title */}
              <div className="mb-5 flex items-center justify-between pr-24">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {isEditing ? 'Редактирование цели' : 'Новая финансовая цель'}
                  </h2>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {isEditing ? 'Измените параметры или целевую сумму' : 'На что вы хотите накопить средства?'}
                  </p>
                </div>
              </div>

              {/* Amount Inputs Cards */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                {/* Target Amount */}
                <div
                  className={`flex flex-col items-center rounded-2xl p-3.5 transition-all ${
                    keyboardField === 'target'
                      ? 'ring-2 ring-mint bg-mint/5 dark:bg-mint/10'
                      : 'neu-inset'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Целевая сумма
                  </span>
                  <div className="flex items-baseline justify-center mt-1">
                    <AmountTrigger
                      value={targetDigits}
                      onChange={setTargetDigits}
                      keyboardOpen={keyboardField === 'target'}
                      onToggleKeyboard={() => setKeyboardField((k) => (k === 'target' ? null : 'target'))}
                      onOpenKeyboard={() => setKeyboardField('target')}
                      onCloseKeyboard={() => setKeyboardField(null)}
                      label="Целевая сумма"
                      keyboardId="goal-target-keyboard"
                      showCurrency={false}
                      showZeroPlaceholder
                    />
                    <span className="ml-1 text-sm font-light text-neutral-400">₽</span>
                  </div>
                </div>

                {/* Already Saved */}
                <div
                  className={`flex flex-col items-center rounded-2xl p-3.5 transition-all ${
                    keyboardField === 'current'
                      ? 'ring-2 ring-mint bg-mint/5 dark:bg-mint/10'
                      : 'neu-inset'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Уже накоплено
                  </span>
                  <div className="flex items-baseline justify-center mt-1">
                    <AmountTrigger
                      value={currentDigits}
                      onChange={setCurrentDigits}
                      keyboardOpen={keyboardField === 'current'}
                      onToggleKeyboard={() => setKeyboardField((k) => (k === 'current' ? null : 'current'))}
                      onOpenKeyboard={() => setKeyboardField('current')}
                      onCloseKeyboard={() => setKeyboardField(null)}
                      label="Уже накоплено"
                      keyboardId="goal-current-keyboard"
                      showCurrency={false}
                      showZeroPlaceholder
                    />
                    <span className="ml-1 text-sm font-light text-neutral-400">₽</span>
                  </div>
                </div>
              </div>

              {keyboardOpen ? (
                /* Режим ввода суммы: клавиатура полностью заменяет блок настроек */
                <div className="flex flex-col gap-3 animate-fade-in">
                  <AmountKeyboard
                    id={keyboardField === 'target' ? 'goal-target-keyboard' : 'goal-current-keyboard'}
                    value={keyboardField === 'target' ? targetDigits : currentDigits}
                    onChange={keyboardField === 'target' ? setTargetDigits : setCurrentDigits}
                    onClose={() => setKeyboardField(null)}
                    label={keyboardField === 'target' ? 'Клавиатура целевой суммы' : 'Клавиатура текущей суммы'}
                    replaceOnFirstDigit
                  />
                  <button
                    type="button"
                    onClick={() => setKeyboardField(null)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Готово
                  </button>
                </div>
              ) : (
                <>
                  {/* Name Input */}
                  <div className="mb-4">
                    <label htmlFor="goal-name-input" className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Название цели
                    </label>
                    <input
                      id="goal-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Например: Отпуск, Новый автомобиль..."
                      className="w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-mint/50 dark:bg-neutral-800 dark:text-white"
                    />
                    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                  </div>

                  {/* Accent Color Selection */}
                  <div className="mb-4">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Цветовой акцент
                    </span>
                    <div className="flex items-center gap-3">
                      {GOAL_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setColor(col.id)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90 ${col.bg} ${
                            color === col.id ? 'ring-2 ring-neutral-900 ring-offset-2 dark:ring-white dark:ring-offset-neutral-950' : 'opacity-70 hover:opacity-100'
                          }`}
                          aria-label={col.label}
                        >
                          {color === col.id && <Check className="h-4 w-4 text-white" strokeWidth={2.5} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Icon Selection */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        Иконка цели
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllIcons((v) => !v)}
                        className="text-xs text-mint hover:underline dark:text-mint"
                      >
                        {showAllIcons ? 'Свернуть' : 'Все иконки'}
                      </button>
                    </div>

                    <div className="grid grid-cols-6 gap-2">
                      {POPULAR_GOAL_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setIconName(icon)}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 ${
                            iconName === icon
                              ? 'bg-mint/20 text-mint ring-1 ring-mint'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
                          }`}
                        >
                          <IconRenderer name={icon} className="h-5 w-5" />
                        </button>
                      ))}
                    </div>

                    {showAllIcons && (
                      <div className="mt-3 rounded-2xl neu-inset p-3 animate-fade-in">
                        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
                          {Object.keys(ICON_GROUPS).map((group) => (
                            <button
                              key={group}
                              type="button"
                              onClick={() => setActiveIconGroup(group)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-all ${
                                activeIconGroup === group
                                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                              }`}
                            >
                              {group}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 grid max-h-36 grid-cols-6 gap-2 overflow-y-auto no-scrollbar p-1">
                          {ICON_GROUPS[activeIconGroup as keyof typeof ICON_GROUPS]?.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => {
                                setIconName(icon);
                                setShowAllIcons(false);
                              }}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90 ${
                                iconName === icon
                                  ? 'bg-mint/20 text-mint ring-1 ring-mint'
                                  : 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <IconRenderer name={icon} className="h-5 w-5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deadline Date (Optional) */}
                  <div className="mb-4">
                    <label htmlFor="goal-deadline-input" className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Целевая дата (необязательно)
                      </span>
                      {deadline && (
                        <button
                          type="button"
                          onClick={() => setDeadline('')}
                          className="text-[11px] text-neutral-400 hover:text-red-500"
                        >
                          Очистить
                        </button>
                      )}
                    </label>
                    <input
                      id="goal-deadline-input"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-sm text-neutral-900 outline-none dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  {/* Linked Account (Optional) */}
                  {accounts.length > 0 && (
                    <div className="mb-4">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        <Layers className="h-3.5 w-3.5" />
                        Привязанный счёт (необязательно)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAccountId(null)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                            accountId === null
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          Без счёта
                        </button>
                        {accounts.filter((a) => !a.isArchived).map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setAccountId(acc.id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                              accountId === acc.id
                                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                            }`}
                          >
                            <IconRenderer name={acc.iconName} className="h-3.5 w-3.5" />
                            <span>{acc.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes / Description */}
                  <div className="mb-6">
                    <label htmlFor="goal-notes-input" className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Заметка (необязательно)
                    </label>
                    <input
                      id="goal-notes-input"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Например: откладывать по 10% с каждой зарплаты"
                      className="w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsDeleting(true)}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20 active:scale-95 dark:bg-red-500/10 dark:text-red-400"
                        aria-label="Удалить цель"
                        title="Удалить цель"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] gpu"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      {isEditing ? 'Сохранить изменения' : 'Создать цель'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
