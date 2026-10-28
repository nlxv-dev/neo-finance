import { Home, PieChart, Plus, Target, Wallet } from 'lucide-react';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`neo-skeleton ${className}`} aria-hidden="true" />;
}

export function StartupSkeleton() {
  const iconSrc = `${import.meta.env.BASE_URL}pwa-192x192.png`;

  return (
    <main className="relative min-h-[100dvh] text-neutral-900 dark:text-white" aria-busy="true">
      <div className="relative mx-auto h-[100dvh] max-w-md overflow-hidden">
        <div className="h-full overflow-hidden pb-32">
          <header className="relative px-5 pb-3 pt-[calc(env(safe-area-inset-top)_+_3rem)]">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 overflow-hidden rounded-xl neu-card-sm">
                <img src={iconSrc} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="text-left">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Добро пожаловать</p>
                <SkeletonBlock className="mt-1.5 h-3.5 w-28 rounded-full" />
              </div>
            </div>

            <div className="relative mt-7">
              <div className="balance-card-stack">
                <div className="balance-card-layer balance-card-layer--far balance-card-layer--main" />
                <div className="balance-card-layer balance-card-layer--near balance-card-layer--main" />
                <div className="neo-balance-card neo-balance-card--main neo-startup-balance-card">
                  <div className="neo-card-topline">
                    <span className="balance-change-pill is-neutral">
                      <SkeletonBlock className="h-2.5 w-12 rounded-full" />
                      <span>за месяц</span>
                    </span>
                    <SkeletonBlock className="h-3 w-8 rounded-full" />
                  </div>
                  <div className="my-auto flex items-baseline gap-2 py-5">
                    <SkeletonBlock className="h-10 w-44 rounded-lg" />
                    <SkeletonBlock className="h-4 w-7 rounded-full" />
                  </div>
                  <div className="neo-card-bottomline">
                    <div className="flex items-center gap-1.5">
                      <SkeletonBlock className="h-5 w-5 rounded-md" />
                      <SkeletonBlock className="h-2.5 w-7 rounded-full" />
                    </div>
                    <span className="neo-card-account-label">Основной баланс</span>
                  </div>
                </div>
              </div>
              <div className="balance-carousel-pagination" aria-hidden="true">
                <SkeletonBlock className="h-1.5 w-5 rounded-full" />
                <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
              </div>
            </div>
          </header>

          <section className="mt-2 px-5">
            <div className="rounded-3xl neu-card p-6 pb-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Бюджет месяца</h2>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800/50 dark:text-neutral-400">
                  {new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date())}
                </span>
              </div>
              <SkeletonBlock className="mt-5 h-2 w-full rounded-full" />
              <div className="mt-4 flex items-center justify-between">
                <SkeletonBlock className="h-6 w-28 rounded-lg" />
                <SkeletonBlock className="h-3 w-24 rounded-full" />
              </div>
            </div>
          </section>

          <section className="mt-7 px-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Последние транзакции</h2>
              <div className="flex gap-1.5 text-[11px] font-medium">
                <span className="rounded-full bg-neutral-900 px-3 py-1 text-white dark:bg-white dark:text-black">Все</span>
                <span className="px-1 py-1 text-neutral-400 dark:text-neutral-500">Доход</span>
                <span className="px-1 py-1 text-neutral-400 dark:text-neutral-500">Расход</span>
              </div>
            </div>
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3 py-3">
                <SkeletonBlock className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-3 w-28 max-w-full rounded-full" />
                  <SkeletonBlock className="h-2.5 w-20 max-w-full rounded-full" />
                </div>
                <SkeletonBlock className="h-3.5 w-20 rounded-full" />
              </div>
            ))}
          </section>
        </div>

        <div className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-md" aria-hidden="true">
          <div className="relative">
            <div className="glass-bar flex h-14 items-center justify-around rounded-full px-5">
              <Home className="h-[18px] w-[18px] text-neutral-400 dark:text-neutral-500" />
              <PieChart className="h-[18px] w-[18px] text-neutral-400 dark:text-neutral-500" />
              <span className="w-[52px] shrink-0" />
              <Wallet className="h-[18px] w-[18px] text-neutral-400 dark:text-neutral-500" />
              <Target className="h-[18px] w-[18px] text-neutral-400 dark:text-neutral-500" />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="plus-btn flex h-[52px] w-[52px] items-center justify-center rounded-full border border-black/5 bg-white/90 shadow-lg dark:border-white/10 dark:bg-white/5">
                <Plus className="h-[22px] w-[22px] text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
