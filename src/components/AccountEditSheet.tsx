import { useEffect, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  CreditCard,
  Coins,
  Landmark,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import type { Account, AccountType } from '@/data/accounts';
import { ACCOUNT_TYPE_LABELS, MAIN_ACCOUNT_ID } from '@/data/accounts';
import { ICON_GROUPS } from '@/data/iconsConfig';
import { IconRenderer } from '@/components/IconRenderer';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { AccountInput } from '@/hooks/useAccounts';
import { getCurrencySymbol } from '@/utils/currency';

const ICON_GROUP_NAMES = Object.keys(ICON_GROUPS);
const DEFAULT_ICON_GROUP = ICON_GROUP_NAMES.includes('Деньги') ? 'Деньги' : (ICON_GROUP_NAMES[0] ?? '');

const TYPE_OPTIONS: Array<{ type: AccountType; label: string; icon: typeof CreditCard }> = [
  { type: 'card', label: ACCOUNT_TYPE_LABELS.card, icon: CreditCard },
  { type: 'cash', label: ACCOUNT_TYPE_LABELS.cash, icon: Coins },
  { type: 'bank', label: ACCOUNT_TYPE_LABELS.bank, icon: Landmark },
  { type: 'savings', label: ACCOUNT_TYPE_LABELS.savings, icon: PiggyBank },
  { type: 'other', label: ACCOUNT_TYPE_LABELS.other, icon: Wallet },
];

const DEFAULT_ICON_BY_TYPE: Record<AccountType, string> = {
  card: 'CreditCard',
  cash: 'Coins',
  bank: 'Landmark',
  savings: 'PiggyBank',
  other: 'Wallet',
};

const COLOR_OPTIONS = [
  { id: 'mint', label: 'Мятный', className: 'bg-mint' },
  { id: 'indigoblue', label: 'Индиго', className: 'bg-indigoblue' },
  { id: 'neutral', label: 'Нейтральный', className: 'bg-neutral-400' },
] as const;

function normalizeColor(color?: string): string {
  if (color === 'mint' || color === 'indigoblue' || color === 'neutral') return color;
  // Older Alex data used tokens not available in Neo Finance (e.g. cobalt).
  return color === 'purple' || color === 'amber' ? 'neutral' : 'indigoblue';
}

interface AccountEditSheetProps {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (data: AccountInput) => void;
  onSetArchived: (id: string, archived: boolean) => void;
  canWrite: boolean;
}

export function AccountEditSheet({
  open,
  onClose,
  account,
  onSave,
  onSetArchived,
  canWrite,
}: AccountEditSheetProps) {
  const isEditing = Boolean(account);
  const isMainAccount = account?.id === MAIN_ACCOUNT_ID;
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [iconName, setIconName] = useState('CreditCard');
  const [balanceDigits, setBalanceDigits] = useState('0');
  const [isNegative, setIsNegative] = useState(false);
  const [color, setColor] = useState('mint');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [activeIconGroup, setActiveIconGroup] = useState(DEFAULT_ICON_GROUP);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'card');
    setIconName(account?.iconName ?? 'CreditCard');
    setBalanceDigits(String(Math.abs(account?.initialBalance ?? 0)));
    setIsNegative((account?.initialBalance ?? 0) < 0);
    setColor(normalizeColor(account?.color));
    setKeyboardOpen(false);
    setShowIconSelector(false);
    setArchiveConfirmation(false);
    setError('');
    setActiveIconGroup(DEFAULT_ICON_GROUP);
  }, [open, account]);

  const currency = account?.currency ?? 'RUB';
  const currencySymbol = getCurrencySymbol(currency);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Введите название счёта');
      return;
    }
    if (!canWrite) return;

    const unsignedBalance = Number.parseInt(balanceDigits || '0', 10) || 0;
    if (!Number.isSafeInteger(unsignedBalance) || unsignedBalance > 1_000_000_000_000) {
      setError('Сумма не должна превышать 1 000 000 000 000 ₽.');
      return;
    }
    onSave({
      name: trimmedName,
      type,
      iconName,
      initialBalance: isEditing
        ? (unsignedBalance === 0 ? 0 : Math.round(unsignedBalance) * (isNegative ? -1 : 1))
        : 0,
      color,
    });
    onClose();
  };

  const handleArchiveAction = () => {
    if (!account || !canWrite) return;
    if (account.isArchived) {
      onSetArchived(account.id, false);
      onClose();
      return;
    }
    if (isMainAccount) return;
    setArchiveConfirmation(true);
  };

  const confirmArchive = () => {
    if (!account || !canWrite || isMainAccount) return;
    onSetArchived(account.id, true);
    onClose();
  };


  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onEscape={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onBackdropClick={() => (keyboardOpen ? setKeyboardOpen(false) : onClose())}
      onPanelClick={(event) => {
        if (!keyboardOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
        setKeyboardOpen(false);
      }}
      ariaLabel={isEditing ? 'Редактирование счёта' : 'Новый счёт'}
      panelClassName="overflow-y-auto no-scrollbar"
      panelStyle={{ maxHeight: '92dvh' }}
    >
      <div className="flex flex-col px-6 pb-7">
        <div className="mb-5 flex items-start justify-between gap-4 pr-10">
          <div>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
              {archiveConfirmation ? 'Архивировать счёт?' : isEditing ? 'Счёт' : 'Новый счёт'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {archiveConfirmation
                ? 'Счёт исчезнет из активного списка, но его баланс и история сохранятся.'
                : isEditing
                  ? 'Измените параметры без потери истории операций.'
                  : 'Новый счёт начнётся с нулевого баланса. Чтобы пополнить его, используйте перевод с другого счёта.'}
            </p>
          </div>
        </div>

        {archiveConfirmation ? (
          <div className="space-y-3">
            <div className="rounded-2xl neu-inset p-4 text-sm text-neutral-600 dark:text-neutral-300">
              Средства на этом счёте останутся в общем балансе и в разделе архивных счетов. Архивацию можно отменить.
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setArchiveConfirmation(false)}
                className="min-h-12 flex-1 rounded-2xl neu-card-sm px-4 text-sm font-medium text-neutral-600 dark:text-neutral-300"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={!canWrite}
                className="min-h-12 flex-1 rounded-2xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                Архивировать
              </button>
            </div>
          </div>
        ) : (
          <>
            {isEditing ? (
            <div className="mb-5 rounded-2xl neu-inset p-4">
              <label className="mb-2 block text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Начальный баланс
              </label>
              <div className="flex items-baseline justify-center">
                {isNegative && <span className="mr-1 text-2xl font-light text-red-500">−</span>}
                <AmountTrigger
                  value={balanceDigits}
                  onChange={(value) => setBalanceDigits(value.replace(/\D/g, '').slice(0, 12))}
                  keyboardOpen={keyboardOpen}
                  onToggleKeyboard={() => setKeyboardOpen((value) => !value)}
                  onOpenKeyboard={() => setKeyboardOpen(true)}
                  onCloseKeyboard={() => setKeyboardOpen(false)}
                  label={`Начальный баланс в ${currency}`}
                  keyboardId="account-balance-keyboard"
                  showCurrency={false}
                  showZeroPlaceholder
                />
                <span className="ml-1 text-xl font-light text-neutral-500 dark:text-neutral-400">{currencySymbol}</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {isEditing ? `Валюта: ${currency}` : 'Новые счета создаются в RUB'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsNegative((value) => !value)}
                  aria-pressed={isNegative}
                  className={`min-h-9 rounded-full px-3 text-[10px] font-medium transition-colors ${isNegative ? 'bg-red-500/10 text-red-500' : 'neu-card-sm text-neutral-500 dark:text-neutral-400'}`}
                >
                  {isNegative ? 'Минус включён' : 'Отрицательный'}
                </button>
              </div>
              {!isMainAccount && (
                <p className="mt-3 text-center text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Корректировка начального баланса меняет общий итог. Это не перевод с другого счёта.
                </p>
              )}
            </div>
            ) : (
              <div className="mb-5 rounded-2xl neu-inset p-4">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Начальный баланс — 0 ₽</p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Счёт создаётся пустым. Чтобы переместить сюда существующие деньги, используйте перевод с другого счёта.
                </p>
              </div>
            )}

            {keyboardOpen ? (
              <div className="space-y-3">
                <AmountKeyboard
                  id="account-balance-keyboard"
                  value={balanceDigits}
                  onChange={(value) => setBalanceDigits(value.replace(/\D/g, '').slice(0, 12))}
                  onClose={() => setKeyboardOpen(false)}
                  label="Клавиатура начального баланса"
                  replaceOnFirstDigit
                />
                <button
                  type="button"
                  onClick={() => setKeyboardOpen(false)}
                  className="min-h-12 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
                >
                  Готово
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="account-name-input" className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Название счёта
                </label>
                <input
                  id="account-name-input"
                  type="text"
                  maxLength={48}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Например, Основная карта"
                  className="mb-1 w-full rounded-xl neu-inset px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-mint/50 dark:text-white"
                />
                {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}

                <section className="mt-4">
                  <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">Тип счёта</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {TYPE_OPTIONS.map(({ type: optionType, label, icon: TypeIcon }) => {
                      const selected = type === optionType;
                      return (
                        <button
                          key={optionType}
                          type="button"
                          onClick={() => {
                            setType(optionType);
                            if (!isEditing) setIconName(DEFAULT_ICON_BY_TYPE[optionType]);
                          }}
                          aria-pressed={selected}
                          className={`flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors ${selected ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'neu-card-sm text-neutral-500 dark:text-neutral-400'}`}
                        >
                          <TypeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="block w-full min-w-0 text-[9px] font-medium leading-[1.15] [overflow-wrap:anywhere]">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Иконка</p>
                    <button
                      type="button"
                      onClick={() => setShowIconSelector((value) => !value)}
                      className="flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      aria-expanded={showIconSelector}
                    >
                      {showIconSelector ? 'Скрыть' : 'Выбрать'}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showIconSelector ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl neu-card-sm p-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color === 'mint' ? 'bg-mint/15 text-mint' : color === 'indigoblue' ? 'bg-indigoblue/15 text-indigoblue' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      <IconRenderer name={iconName} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{iconName}</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Предпросмотр счёта</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {COLOR_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setColor(option.id)}
                          aria-label={`Цвет: ${option.label}`}
                          aria-pressed={color === option.id}
                          className={`h-7 w-7 rounded-full ${option.className} ${color === option.id ? 'ring-2 ring-neutral-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-neutral-950' : 'opacity-60'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {showIconSelector && (
                    <div className="mt-3 rounded-2xl neu-inset p-3">
                      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
                        {ICON_GROUP_NAMES.map((group) => (
                          <button
                            key={group}
                            type="button"
                            onClick={() => setActiveIconGroup(group)}
                            className={`min-h-8 whitespace-nowrap rounded-full px-2.5 text-[10px] font-medium ${activeIconGroup === group ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}
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
                            onClick={() => { setIconName(icon); setShowIconSelector(false); }}
                            aria-label={`Выбрать иконку ${icon}`}
                            aria-pressed={iconName === icon}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconName === icon ? 'bg-mint/15 text-mint ring-1 ring-mint/40' : 'text-neutral-500 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
                          >
                            <IconRenderer name={icon} className="h-5 w-5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {!isMainAccount && account && (
                  <div className="mt-5 border-t border-neutral-200/60 pt-4 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={handleArchiveAction}
                      disabled={!canWrite}
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                    >
                      {account.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {account.isArchived ? 'Вернуть из архива' : 'Архивировать счёт'}
                    </button>
                  </div>
                )}
                {isMainAccount && (
                  <p className="mt-4 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                    Основной счёт системный: он сохраняет совместимость с историческими операциями и не может быть архивирован.
                  </p>
                )}

                {!canWrite && (
                  <p role="status" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Изменения временно недоступны: сначала нужно восстановить доступ к локальным данным.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canWrite}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  {isEditing ? 'Сохранить изменения' : 'Создать счёт'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
