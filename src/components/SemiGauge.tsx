import { useEffect, useState } from 'react';

interface SemiGaugeProps {
  spent: number;
  budget: number;
  safeToSpend: number;
}

export function SemiGauge({ spent, budget, safeToSpend }: SemiGaugeProps) {
  const [animatedSpent, setAnimatedSpent] = useState(0);

  useEffect(() => {
    const targetRatio = spent / budget;
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedSpent(start + (targetRatio - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [spent, budget]);

  const totalTicks = 80;
  const spentRatio = Math.min(animatedSpent, 1);
  const spentTicks = Math.round(spentRatio * totalTicks);

  const radius = 120;
  const tickCount = totalTicks;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const angleStep = (endAngle - startAngle) / (tickCount - 1);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 160 }}>
      <svg
        width={280}
        height={160}
        viewBox="0 0 280 160"
        className="gpu"
      >
        <defs>
          <linearGradient id="tickGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="50%" stopColor="#05D9A4" />
            <stop offset="100%" stopColor="#6366F1" />
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
              stroke={isSpent ? 'url(#tickGradient)' : 'currentColor'}
              strokeWidth={isLong ? 2.5 : 1.5}
              strokeLinecap="round"
              filter={isNearEnd ? 'url(#tickGlow)' : undefined}
              className={
                isSpent
                  ? 'opacity-90'
                  : 'text-neutral-300 dark:text-neutral-700 opacity-40 dark:opacity-30'
              }
              style={{
                transition: 'stroke 0.3s ease, opacity 0.3s ease',
              }}
            />
          );
        })}

        {/* Needle indicator */}
        <circle
          cx={140 + Math.cos(startAngle + spentRatio * (endAngle - startAngle)) * (radius - 6)}
          cy={140 + Math.sin(startAngle + spentRatio * (endAngle - startAngle)) * (radius - 6)}
          r="4"
          fill="url(#tickGradient)"
          filter="url(#tickGlow)"
        />
      </svg>

      {/* Center display */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center pointer-events-none">
        <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Доступно к трате
        </span>
        <span className="mt-1 font-light tracking-tight text-3xl text-neutral-900 dark:text-white tabular-nums">
          {safeToSpend.toLocaleString('ru-RU')}
          <span className="ml-1 text-lg text-neutral-400 dark:text-neutral-500">₽</span>
        </span>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-mint to-indigoblue" />
            Потрачено {Math.round(spentRatio * 100)}%
          </span>
          <span className="opacity-40">|</span>
          <span>Бюджет {budget.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>
    </div>
  );
}
