import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getBudgetStatus, type BudgetStatus } from '@/data/mockData';

interface SemiGaugeProps {
  spent: number;
  budget: number;
  safeToSpend: number;
  onEditBudget: () => void;
}

const gradientStops: Record<BudgetStatus, { from: string; mid: string; to: string }> = {
  normal: { from: '#4ADE80', mid: '#05D9A4', to: '#6366F1' },
  warning: { from: '#f59e0b', mid: '#fb923c', to: '#f59e0b' },
  overbudget: { from: '#ef4444', mid: '#ef4444', to: '#ef4444' },
};

export function SemiGauge({ spent, budget, safeToSpend, onEditBudget }: SemiGaugeProps) {
  const [animatedSpent, setAnimatedSpent] = useState(0);
  const amountButtonRef = useRef<HTMLButtonElement>(null);
  const amountTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const targetRatio = spent / budget;
    const start = 0;
    const duration = 1200;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedSpent(start + (targetRatio - start) * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [spent, budget]);

  const status = getBudgetStatus(spent, budget);
  const colors = gradientStops[status];
  const gradientId = `tickGradient-${status}`;

  const totalTicks = 80;
  const isOverbudget = spent > budget;
  const spentRatio = Math.min(animatedSpent, 1);
  const spentTicks = Math.round(spentRatio * totalTicks);
  const displayedAmount = `${isOverbudget ? '−' : ''}${Math.abs(Math.round(safeToSpend)).toLocaleString('ru-RU')}`;

  // Fit the whole amount (minus sign, digits and currency) inside the gauge's safe zone.
  // This is based on actual rendered width, so it also handles values we did not anticipate.
  useLayoutEffect(() => {
    const button = amountButtonRef.current;
    const text = amountTextRef.current;
    if (!button || !text) return;

    let isActive = true;

    const fitAmount = () => {
      const availableWidth = button.clientWidth;
      if (!availableWidth) return;

      let fontSize = 30;
      text.style.fontSize = `${fontSize}px`;

      while (text.getBoundingClientRect().width > availableWidth && fontSize > 18) {
        fontSize -= 1;
        text.style.fontSize = `${fontSize}px`;
      }
    };

    fitAmount();
    // Re-check after the app's web font finishes loading, in case glyph widths change.
    void document.fonts.ready.then(() => {
      if (isActive) fitAmount();
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(fitAmount);
      observer.observe(button);
      return () => {
        isActive = false;
        observer.disconnect();
      };
    }

    window.addEventListener('resize', fitAmount);
    return () => {
      isActive = false;
      window.removeEventListener('resize', fitAmount);
    };
  }, [displayedAmount]);

  const radius = 120;
  const tickCount = totalTicks;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const angleStep = (endAngle - startAngle) / (tickCount - 1);
  const spentPercent = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  return (
    <div className="flex w-full max-w-[280px] flex-col items-center">
      {/* Fixed-aspect-ratio drawing area keeps the gauge geometry predictable. */}
      <div className="relative aspect-[7/4] w-full">
        <svg
          viewBox="0 0 280 160"
          className="absolute inset-0 h-full w-full gpu"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.from} />
              <stop offset="50%" stopColor={colors.mid} />
              <stop offset="100%" stopColor={colors.to} />
            </linearGradient>
            <filter id="tickGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: tickCount }, (_, i) => {
            const angle = startAngle + i * angleStep;
            const isLong = i % 5 === 0;
            const innerR = isLong ? radius - 18 : radius - 12;
            const outerR = radius + 2;
            const cx = 140;
            const cy = 140;

            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            const isSpent = i < spentTicks;
            const isNearEnd = i >= spentTicks - 3 && i < spentTicks;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isSpent ? `url(#${gradientId})` : 'currentColor'}
                strokeWidth={isLong ? 2.5 : 1.5}
                strokeLinecap="round"
                filter={isNearEnd ? 'url(#tickGlow)' : undefined}
                className={
                  isSpent
                    ? 'opacity-90'
                    : 'text-neutral-300 dark:text-neutral-700 opacity-40 dark:opacity-30'
                }
                style={{ transition: 'stroke 0.3s ease, opacity 0.3s ease' }}
              />
            );
          })}

          {/* Needle indicator */}
          <circle
            cx={140 + Math.cos(startAngle + spentRatio * (endAngle - startAngle)) * (radius - 6)}
            cy={140 + Math.sin(startAngle + spentRatio * (endAngle - startAngle)) * (radius - 6)}
            r="4"
            fill={`url(#${gradientId})`}
            filter="url(#tickGlow)"
          />
        </svg>

        {/* The available amount is the direct entry point to budget editing. */}
        <div className="absolute inset-x-0 bottom-[10%] flex flex-col items-center">
          <span className="text-center text-[10px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {isOverbudget ? 'Перерасход' : 'Доступно к трате'}
          </span>

          <button
            ref={amountButtonRef}
            type="button"
            onClick={onEditBudget}
            aria-label={`Изменить месячный бюджет: ${budget.toLocaleString('ru-RU')} рублей`}
            className="mt-1 flex h-11 w-[80%] max-w-[224px] items-center justify-center rounded-lg transition-opacity hover:opacity-80 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
          >
            <span
              ref={amountTextRef}
              className={`inline-flex items-baseline whitespace-nowrap font-light leading-none tracking-tight tabular-nums ${
                isOverbudget
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-neutral-900 dark:text-white'
              }`}
            >
              {displayedAmount}
              <span className="ml-1 text-[0.62em] text-neutral-400 dark:text-neutral-500">₽</span>
            </span>
          </button>
        </div>
      </div>

      {/* Details sit below the gauge endpoints, never on top of the ticks. */}
      <div className="flex min-h-11 w-full items-center justify-center gap-2 text-[11px] leading-4 text-neutral-400 dark:text-neutral-500">
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                status === 'normal'
                  ? 'linear-gradient(to right, #4ADE80, #6366F1)'
                  : status === 'warning'
                    ? '#f59e0b'
                    : '#ef4444',
            }}
          />
          Потрачено {spentPercent}%
        </span>
        <span className="shrink-0 opacity-40">|</span>
        <button
          type="button"
          onClick={onEditBudget}
          aria-label={`Изменить месячный бюджет: ${budget.toLocaleString('ru-RU')} рублей`}
          className="inline-flex min-h-11 min-w-0 items-center rounded-md transition-opacity hover:opacity-75 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60"
        >
          <span className="whitespace-nowrap">Бюджет {budget.toLocaleString('ru-RU')} ₽</span>
        </button>
      </div>
    </div>
  );
}
