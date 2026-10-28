import { useSyncExternalStore } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import {
  applyPwaUpdate,
  dismissPwaOfflineReady,
  dismissPwaUpdate,
  dismissPwaUpdateError,
  getPwaUpdateSnapshot,
  subscribePwaUpdateState,
} from '@/pwa/serviceWorkerManager';

export function PwaUpdatePrompt() {
  const state = useSyncExternalStore(
    subscribePwaUpdateState,
    getPwaUpdateSnapshot,
    getPwaUpdateSnapshot,
  );

  if (!state.updateAvailable && !state.offlineReady && !state.error) return null;

  return (
    <aside
      className="fixed left-4 right-4 z-[300] mx-auto max-w-md"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      aria-live="polite"
      aria-atomic="true"
    >
      {state.updateAvailable ? (
        <section className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-white shadow-2xl shadow-black/25">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Доступно обновление Neo Finance</p>
              <p className="mt-1 text-xs leading-5 text-neutral-300">
                Сначала сохраните незавершённые изменения. После обновления приложение перезапустится.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissPwaUpdate}
              disabled={state.isApplyingUpdate}
              aria-label="Отложить обновление"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-200">
              {state.error}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={dismissPwaUpdate}
              disabled={state.isApplyingUpdate}
              className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Позже
            </button>
            <button
              type="button"
              onClick={() => void applyPwaUpdate()}
              disabled={state.isApplyingUpdate}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {state.isApplyingUpdate ? <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {state.isApplyingUpdate ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
        </section>
      ) : null}

      {!state.updateAvailable && state.offlineReady ? (
        <section className="flex items-start gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 text-white shadow-2xl shadow-black/25">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Neo Finance готов к работе офлайн</p>
            <p className="mt-1 text-xs leading-5 text-neutral-300">Файлы приложения сохранены для запуска без сети.</p>
          </div>
          <button
            type="button"
            onClick={dismissPwaOfflineReady}
            aria-label="Закрыть сообщение об офлайн-режиме"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white "
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {!state.updateAvailable && !state.offlineReady && state.error ? (
        <section className="rounded-2xl border border-red-400/20 bg-neutral-950 p-4 text-white shadow-2xl shadow-black/25">
          <div className="flex items-start gap-3">
            <p role="alert" className="min-w-0 flex-1 text-xs leading-5 text-red-200">{state.error}</p>
            <button
              type="button"
              onClick={dismissPwaUpdateError}
              aria-label="Закрыть сообщение об ошибке обновления"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white "
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void applyPwaUpdate()}
            disabled={state.isApplyingUpdate}
            className="mt-3 min-h-11 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
          >
            {state.isApplyingUpdate ? 'Обновляем…' : 'Повторить обновление'}
          </button>
        </section>
      ) : null}
    </aside>
  );
}
