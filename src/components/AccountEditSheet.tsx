import { useState, useEffect } from 'react';
import {
  X,
  Check,
  CreditCard,
  Coins,
  Landmark,
  PiggyBank,
  Wallet,
  Trash2,
} from 'lucide-react';
import type { Account, AccountType } from '@/data/accounts';
import { ACCOUNT_TYPE_LABELS } from '@/data/accounts';
import { ICON_GROUPS } from '@/data/iconsConfig';
import { IconRenderer } from '@/components/IconRenderer';
import { DeleteConfirmationPanel } from '@/components/DeleteConfirmationPanel';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import type { AccountInput } from '@/hooks/useAccounts';

const ICON_GROUP_NAMES = Object.keys(ICON_GROUPS);
const DEFAULT_ICON_GROUP = ICON_GROUP_NAMES.includes('Деньги')
  ? 'Деньги'
  : (ICON_GROUP_NAMES[0] ?? '');

const TYPE_OPTIONS: Array<{ type: AccountType; label: string; icon: typeof CreditCard }> = [
  { type: 'card', label: ACCOUNT_TYPE_LABELS.card, icon: CreditCard },
  { type: 'cash', label: ACCOUNT_TYPE_LABELS.cash, icon: Coins },
  { type: 'bank', label: ACCOUNT_TYPE_LABELS.bank, icon: Landmark },
  { type: 'savings', label: ACCOUNT_TYPE_LABELS.savings, icon: PiggyBank },
  { type: 'other', label: ACCOUNT_TYPE_LABELS.other, icon: Wallet },
];

const COLOR_OPTIONS = [
  { id: 'mint', label: 'Мятный', bg: 'bg-mint' },
  { id: 'indigoblue', label: 'Индиго', bg: 'bg-indigoblue' },
  { id: 'cobalt', label: 'Кобальт', bg: 'bg-cobalt' },
  { id: 'amber', label: 'Янтарный', bg: 'bg-amber-500' },
  { id: 'purple', label: 'Пурпурный', bg: 'bg-purple-500' },
];

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR'];

interface AccountEditSheetProps {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (data: AccountInput) => void;
  onDelete?: (id: string) => void;
  isUsedInTransactions?: boolean;
  canDelete?: boolean;
}

export function AccountEditSheet({
  open,
  onClose,
  account,
  onSave,
  onDelete,
  isUsedInTransactions = false,
  canDelete = true,
}: AccountEditSheetProps) {
  const isEditing = Boolean(account);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [iconName, setIconName] = useState('CreditCard');
  const [currency, setCurrency] = useState('RUB');
  const [balanceDigits, setBalanceDigits] = useState('0');
  const [color, setColor] = useState('mint');

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [activeIconGroup, setActiveIconGroup] = useState<string>(DEFAULT_ICON_GROUP);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (account) {
        setName(account.name);
        setType(account.type);
        setIconName(account.iconName);
        setCurrency(account.currency || 'RUB');
        setBalanceDigits(String(Math.abs(account.initialBalance)));
        setColor(account.color || 'mint');
      } else {
        setName('');
        setType('card');
        setIconName('CreditCard');
        setCurrency('RUB');
        setBalanceDigits('0');
        setColor('mint');
      }
      setKeyboardOpen(false);
      setShowIconSelector(false);
      setIsDeleting(false);
      setError('');
    }
  }, [open, account]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const handleTypeSelect = (selectedType: AccountType) => {
    setType(selectedType);
    if (!account) {
      if (selectedType === 'cash') setIconName('Coins');
      else if (selectedType === 'card') setIconName('CreditCard');
      else if (selectedType === 'bank') setIconName('Landmark');
      else if (selectedType === 'savings') setIconName('PiggyBank');
      else setIconName('Wallet');
    }
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название счёта');
      return;
    }

    const initialBalance = parseInt(balanceDigits || '0', 10) || 0;

    onSave({
      name: trimmed,
      type,
      iconName,
      currency,
      initialBalance,
      color,
    });

    onClose();
  };

  const handleDeleteConfirm = () => {
    if (account && onDelete) {
      onDelete(account.id);
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
          if (keyboardOpen) setKeyboardOpen(false);
          else onClose();
        }}
      />

      {/* Sheet */}
      <div
        onClick={(e) => {
          if (!keyboardOpen) return;
          const target = e.target as HTMLElement;
          if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
          setKeyboardOpen(false);
        }}
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu overflow-y-auto no-scrollbar ${
          keyboardOpen ? 'max-h-[95dvh]' : 'max-h-[88vh]'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Header Actions */}
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
                title="Удаление счёта"
                description={
                  isUsedInTransactions
                    ? `Счёт «${account?.name}» используется в истории операций. Он будет архивирован: история сохранится, но счёт перестанет отображаться для новых операций.`
                    : `Вы уверены, что хотите удалить счёт «${account?.name}»? Это действие нельзя отменить.`
                }
                onConfirm={handleDeleteConfirm}
                onCancel={() => setIsDeleting(false)}
                confirmLabel={isUsedInTransactions ? 'Архивировать' : 'Удалить'}
              />
            </div>
          ) : (
            <>
              {/* Header Title */}
              <div className="mb-5 flex items-center justify-between pr-24">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {isEditing ? 'Редактирование счёта' : 'Новый счёт'}
                  </h2>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {isEditing ? 'Измените параметры счёта или баланс' : 'Добавьте кошелёк, карту или накопительный счёт'}
                  </p>
                </div>
              </div>

              {/* Initial Balance Input */}
              <div className="mb-5 flex flex-col items-center rounded-2xl neu-inset p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {isEditing ? 'Начальный баланс счёта' : 'Стартовый баланс'}
                </span>
                <div className="flex items-baseline justify-center">
                  <AmountTrigger
                    value={balanceDigits}
                    onChange={setBalanceDigits}
                    keyboardOpen={keyboardOpen}
                    onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
                    onOpenKeyboard={() => setKeyboardOpen(true)}
                    onCloseKeyboard={() => setKeyboardOpen(false)}
                    label="Баланс счёта"
                    keyboardId="account-balance-keyboard"
                    showCurrency={false}
                    showZeroPlaceholder
                  />
                  <span className="ml-1 text-xl font-light text-neutral-400 dark:text-neutral-500">
                    {currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : '€'}
                  </span>
                </div>
              </div>

              {keyboardOpen ? (
                /* Режим ввода суммы: клавиатура полностью заменяет блок настроек */
                <div className="flex flex-col gap-3 animate-fade-in">
                  <AmountKeyboard
                    id="account-balance-keyboard"
                    value={balanceDigits}
                    onChange={setBalanceDigits}
                    onClose={() => setKeyboardOpen(false)}
                    label="Клавиатура баланса"
                    replaceOnFirstDigit
                  />
                  <button
                    type="button"
                    onClick={() => setKeyboardOpen(false)}
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
                <label htmlFor="account-name-input" className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Название счёта
                </label>
                <div className="relative">
                  <input
                    id="account-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Например: Карта зарплатная, Наличные..."
                    className="w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-mint/50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>

              {/* Account Type Selector */}
              <div className="mb-4">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Тип счёта
                </span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {TYPE_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = type === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleTypeSelect(item.type)}
                        className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Currency Selector */}
              <div className="mb-4">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Валюта
                </span>
                <div className="flex gap-2">
                  {CURRENCY_OPTIONS.map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrency(curr)}
                      className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all active:scale-95 ${
                        currency === curr
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {curr === 'RUB' ? 'Рубль (₽)' : curr === 'USD' ? 'Доллар ($)' : 'Евро (€)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color Selector */}
              <div className="mb-4">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Цвет карточки
                </span>
                <div className="flex items-center gap-3">
                  {COLOR_OPTIONS.map((col) => (
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

              {/* Icon Selector (Collapsible) */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Иконка
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowIconSelector((v) => !v)}
                    className="text-xs text-mint hover:underline dark:text-mint"
                  >
                    {showIconSelector ? 'Скрыть иконки' : 'Выбрать другую иконку'}
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl neu-card-sm">
                    <IconRenderer name={iconName} className="h-6 w-6 text-neutral-800 dark:text-white" />
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Текущая иконка: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{iconName}</span>
                  </span>
                </div>

                {showIconSelector && (
                  <div className="mt-3 rounded-2xl neu-inset p-3">
                    <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
                      {ICON_GROUP_NAMES.map((group) => (
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
                            setShowIconSelector(false);
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

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsDeleting(true)}
                    disabled={!canDelete}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-red-500/10 dark:text-red-400"
                    aria-label="Удалить счёт"
                    title={!canDelete ? 'Нельзя удалить единственный активный счёт' : 'Удалить счёт'}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] gpu shadow-sm"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  {isEditing ? 'Сохранить изменения' : 'Создать счёт'}
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
