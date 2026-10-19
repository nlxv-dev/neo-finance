import { useEffect, useRef, type TouchEvent } from 'react';
import { Delete } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import { appendAmountDigit } from '@/data/amountInput';


interface AmountTriggerProps {
  value: string;
  onChange: (value: string) => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
  onOpenKeyboard: () => void;
  onCloseKeyboard: () => void;
  label: string;
  keyboardId: string;
  size?: 'large' | 'medium';
  /** Hide the currency suffix when the surrounding form already establishes the currency. */
  showCurrency?: boolean;
}

/** Button styled as the amount field. Using a button guarantees no OS keyboard is summoned. */
export function AmountTrigger({
  value,
  onChange,
  keyboardOpen,
  onToggleKeyboard,
  onOpenKeyboard,
  onCloseKeyboard,
  label,
  keyboardId,
  size = 'large',
  showCurrency = true,
}: AmountTriggerProps) {
  const displayedValue = value ? formatCurrency(Number(value)) : '';

  return (
    <button
      type="button"
      data-amount-trigger
      aria-label={`${label}: ${displayedValue || 'не задана'}. Нажмите, чтобы ${keyboardOpen ? 'скрыть' : 'открыть'} цифровую клавиатуру`}
      aria-expanded={keyboardOpen}
      aria-controls={keyboardOpen ? keyboardId : undefined}
      onClick={onToggleKeyboard}
      onKeyDown={(event) => {
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          onChange(appendAmountDigit(value, event.key));
          onOpenKeyboard();
        } else if (event.key === 'Backspace') {
          event.preventDefault();
          onChange(value.slice(0, -1));
        } else if (event.key === 'Escape') {
          onCloseKeyboard();
        }
      }}
      className={`min-h-[56px] min-w-[112px] flex-1 cursor-pointer rounded-xl bg-transparent px-2 text-center font-light tracking-tight text-neutral-900 outline-none tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-mint/50 dark:text-white ${size === 'large' ? 'text-[clamp(2rem,10vw,3rem)]' : 'text-[clamp(1.75rem,9vw,2.25rem)]'}`}
    >
      <span className={displayedValue ? '' : 'text-neutral-300 dark:text-neutral-600'}>
        {displayedValue || '0'}
      </span>
      {showCurrency && (
        <span className="ml-1 text-[0.62em] font-light text-neutral-400 dark:text-neutral-500">₽</span>
      )}
    </button>
  );
}

interface AmountKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  label?: string;
  id?: string;
  replaceOnFirstDigit?: boolean;
}

/** Shared in-app keypad for whole-ruble amounts. It never invokes the OS keyboard. */
export function AmountKeyboard({
  value,
  onChange,
  onClose,
  label = 'Цифровая клавиатура для суммы',
  id,
  replaceOnFirstDigit = false,
}: AmountKeyboardProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const replaceNextDigit = useRef(replaceOnFirstDigit && value.length > 0);
  const handleTouchStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    cancelLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      onChange('');
      longPressTriggered.current = true;
    }, 550);
  };

  const deleteLastDigit = () => {
    replaceNextDigit.current = false;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onChange(value.slice(0, -1));
  };

  const handleHandleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    handleTouchStart.current = event.touches[0]?.clientY ?? null;
  };

  const handleHandleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    const startY = handleTouchStart.current;
    const endY = event.changedTouches[0]?.clientY;
    handleTouchStart.current = null;
    if (startY !== null && endY !== undefined && endY - startY > 36) {
      onClose();
    }
  };

  const pressDigit = (digit: string) => {
    if (replaceNextDigit.current) {
      replaceNextDigit.current = false;
      onChange(digit);
      return;
    }
    onChange(appendAmountDigit(value, digit));
  };

  return (
    <div
      id={id}
      data-amount-keyboard
      role="group"
      aria-label={label}
      className="shrink-0 rounded-[26px] border border-neutral-200/70 bg-neutral-100/70 p-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <button
        type="button"
        aria-label="Скрыть цифровую клавиатуру; проведите вниз, чтобы закрыть"
        onClick={onClose}
        onTouchStart={handleHandleTouchStart}
        onTouchEnd={handleHandleTouchEnd}
        className="flex h-5 w-full touch-none items-center justify-center"
      >
        <span className="h-1 w-9 rounded-full bg-neutral-300 dark:bg-neutral-600" />
      </button>

      <div className="mt-1 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pressDigit(digit)}
            className="flex min-h-[48px] items-center justify-center rounded-2xl neu-card-sm text-xl font-medium tabular-nums text-neutral-800 transition-transform duration-100 active:scale-[0.96] dark:text-neutral-100"
            aria-label={digit}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={() => pressDigit('0')}
          className="col-start-2 flex min-h-[48px] items-center justify-center rounded-2xl neu-card-sm text-xl font-medium tabular-nums text-neutral-800 transition-transform duration-100 active:scale-[0.96] dark:text-neutral-100"
          aria-label="0"
        >
          0
        </button>

        <button
          type="button"
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={deleteLastDigit}
          className="col-start-3 flex min-h-[48px] items-center justify-center rounded-2xl bg-transparent text-neutral-500 transition-opacity duration-100 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:text-neutral-300 dark:focus-visible:ring-white/25"
          aria-label="Удалить последнюю цифру; удерживайте для очистки суммы"
          title="Удерживайте, чтобы очистить сумму"
        >
          <Delete className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
