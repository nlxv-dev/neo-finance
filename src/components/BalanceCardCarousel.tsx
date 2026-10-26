import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import type { Account } from '@/data/accounts';
import { MAIN_ACCOUNT_ID } from '@/data/accounts';
import { formatCurrency, type Transaction } from '@/data/mockData';
import { getCurrencySymbol } from '@/utils/currency';
import { calculateAccountMonthlyMovement } from '@/utils/accountAnalytics';

export const ADD_ACCOUNT_CARD_KEY = '__neo_finance_add_account__';

type AccountSlide = { key: string; kind: 'account'; account: Account };
type AddAccountSlide = { key: typeof ADD_ACCOUNT_CARD_KEY; kind: 'add' };
type CardSlide = AccountSlide | AddAccountSlide;

interface BalanceCardCarouselProps {
  accounts: Account[];
  accountBalances: Record<string, number>;
  transactions: Transaction[];
  currentMonthKey: string;
  activeCardKey: string;
  canWriteAccounts: boolean;
  onSelectCard: (key: string) => void;
  onEditBalance: (accountId: string) => void;
  onAddAccount: () => void;
}

function getCardLabel(account: Account): string {
  return account.id === MAIN_ACCOUNT_ID ? 'Основной баланс' : account.name;
}

function getCardVariant(account: Account): string {
  if (account.color === 'neutral') return 'neutral';
  if (account.color === 'indigoblue') return 'indigo';
  if (account.id === MAIN_ACCOUNT_ID) return 'main';

  switch (account.type) {
    case 'cash': return 'cash';
    case 'bank': return 'indigo';
    case 'savings': return 'savings';
    case 'other': return 'neutral';
    default: return 'mint';
  }
}

export function BalanceCardCarousel({
  accounts,
  accountBalances,
  transactions,
  currentMonthKey,
  activeCardKey,
  canWriteAccounts,
  onSelectCard,
  onEditBalance,
  onAddAccount,
}: BalanceCardCarouselProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [direction, setDirection] = useState<'next' | 'previous'>('next');

  const slides = useMemo<CardSlide[]>(() => {
    const activeAccounts = accounts
      .filter((account) => !account.isArchived)
      .slice()
      .sort((left, right) => {
        if (left.id === MAIN_ACCOUNT_ID) return -1;
        if (right.id === MAIN_ACCOUNT_ID) return 1;
        return 0;
      });
    return [
      ...activeAccounts.map((account) => ({ key: account.id, kind: 'account' as const, account })),
      { key: ADD_ACCOUNT_CARD_KEY, kind: 'add' as const },
    ];
  }, [accounts]);

  const requestedIndex = slides.findIndex((slide) => slide.key === activeCardKey);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const activeSlide = slides[activeIndex] ?? slides[0];
  const nearSlide = slides[(activeIndex + 1) % slides.length] ?? activeSlide;
  const farSlide = slides[(activeIndex + 2) % slides.length] ?? nearSlide;
  const knownAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);

  useEffect(() => {
    if (activeSlide && activeSlide.key !== activeCardKey) onSelectCard(activeSlide.key);
  }, [activeCardKey, activeSlide, onSelectCard]);

  const move = (step: number) => {
    if (slides.length < 2) return;
    const nextIndex = (activeIndex + step + slides.length) % slides.length;
    setDirection(step > 0 ? 'next' : 'previous');
    onSelectCard(slides[nextIndex].key);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 350);
    move(deltaX < 0 ? 1 : -1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
  };

  const handleActiveCardClick = (slide: CardSlide) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (slide.kind === 'add') {
      if (canWriteAccounts) onAddAccount();
      return;
    }
    onEditBalance(slide.account.id);
  };

  const renderLayerVariant = (slide: CardSlide) => slide.kind === 'add' ? 'add' : getCardVariant(slide.account);
  const activeAccount = activeSlide?.kind === 'account' ? activeSlide.account : null;
  const activeBalance = activeAccount ? (accountBalances[activeAccount.id] ?? activeAccount.initialBalance) : 0;
  const monthlyMovement = activeAccount
    ? calculateAccountMonthlyMovement(transactions, activeAccount.id, currentMonthKey, knownAccountIds)
    : 0;
  const currency = activeAccount ? getCurrencySymbol(activeAccount.currency) : '';

  return (
    <div
      className="balance-carousel select-none"
      role="group"
      aria-roledescription="карусель счетов"
      aria-label={`Счёт ${activeIndex + 1} из ${slides.length}${activeAccount ? `: ${getCardLabel(activeAccount)}` : ': создать новый счёт'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="balance-card-stack" aria-live="polite">
        <div className={`balance-card-layer balance-card-layer--far balance-card-layer--${renderLayerVariant(farSlide)}`} aria-hidden="true" />
        <div className={`balance-card-layer balance-card-layer--near balance-card-layer--${renderLayerVariant(nearSlide)}`} aria-hidden="true" />

        {activeAccount ? (
          <button
            key={activeAccount.id}
            type="button"
            className={`neo-balance-card neo-balance-card--${getCardVariant(activeAccount)} neo-balance-card--enter-${direction}`}
            onClick={() => handleActiveCardClick(activeSlide)}
            aria-label={`Изменить текущий баланс «${getCardLabel(activeAccount)}»: ${formatCurrency(activeBalance)} ${currency}`}
          >
            <span className="neo-card-highlight" aria-hidden="true" />
            <span className="neo-card-orb" aria-hidden="true"><span className="neo-card-pearl" /></span>

            <span className="neo-card-topline">
              <span className={`balance-change-pill ${monthlyMovement > 0 ? 'is-positive' : monthlyMovement < 0 ? 'is-negative' : 'is-neutral'}`}>
                {monthlyMovement > 0 ? (
                  <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
                ) : monthlyMovement < 0 ? (
                  <ArrowDownRight size={13} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Minus size={13} strokeWidth={2.2} aria-hidden="true" />
                )}
                <span>{monthlyMovement > 0 ? '+' : monthlyMovement < 0 ? '−' : ''}{formatCurrency(Math.abs(monthlyMovement))} {currency} за месяц</span>
              </span>
              <span className="neo-card-index">{String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
            </span>

            <span className="neo-card-balance">
              <AnimatedCounter value={activeBalance} />
              <span className="neo-card-currency">{currency}</span>
            </span>

            <span className="neo-card-bottomline">
              <span className="neo-card-brand" aria-hidden="true"><span>N</span><i /><i /><i /></span>
              <span className="neo-card-account-label">{getCardLabel(activeAccount)}</span>
            </span>
          </button>
        ) : (
          <button
            key={ADD_ACCOUNT_CARD_KEY}
            type="button"
            className={`neo-balance-card neo-balance-card--add neo-balance-card--enter-${direction}`}
            onClick={() => handleActiveCardClick(activeSlide)}
            disabled={!canWriteAccounts}
            aria-label="Создать новый счёт"
          >
            <span className="neo-add-card-glow" aria-hidden="true" />
            <Plus className="neo-add-card-plus" size={58} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="balance-carousel-pagination" role="group" aria-label="Выбрать счёт">
        {slides.map((slide, index) => (
          <button
            key={slide.key}
            type="button"
            className={`balance-carousel-dot-hit ${slide.key === activeSlide.key ? 'is-active' : ''}`}
            onClick={() => {
              setDirection(index > activeIndex ? 'next' : 'previous');
              onSelectCard(slide.key);
            }}
            aria-label={slide.kind === 'add' ? 'Перейти к созданию нового счёта' : `Показать счёт: ${slide.account.name}`}
            aria-pressed={slide.key === activeSlide.key}
          >
            <span className="balance-carousel-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
