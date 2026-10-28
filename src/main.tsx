import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App, { preloadAppScreens } from './App.tsx';
import { StartupSkeleton } from './components/StartupSkeleton.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeDatabaseStorage, restoreDatabaseSnapshot } from './storage/databaseStorage';
import { downloadRecoverySnapshot } from './storage/safeLocalStorage';
import { validateBackupFile, type BackupFile } from './backup/backupService';
import './index.css';
import { startPwaServiceWorkerRegistration } from './pwa/serviceWorkerManager';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Не найден корневой элемент приложения.');
const root = createRoot(rootElement);

// The service worker is registered for production builds only. The prompt UI
// lets the user decide when it is safe to activate an update.
startPwaServiceWorkerRegistration();

function StartupErrorScreen({ message, details }: { message: string; details?: string }) {
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  async function handleBackupSelection(file: File | null) {
    setRestoreError(null);
    setPendingBackup(null);
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      setPendingBackup(validateBackupFile(parsed));
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Не удалось прочитать JSON-копию.');
    }
  }

  async function handleRestore() {
    if (!pendingBackup || isRestoring) return;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await restoreDatabaseSnapshot(pendingBackup.data);
      // Re-check database invariants before restarting the normal application.
      await initializeDatabaseStorage();
      window.location.reload();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Не удалось восстановить данные из копии.');
      setIsRestoring(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
        <div className="mb-4 h-12 w-12 overflow-hidden rounded-2xl" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-lg font-semibold">Neo Finance</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">{message}</p>
        {details ? <p className="mt-3 break-words rounded-xl bg-white/5 p-3 text-xs leading-5 text-neutral-400">{details}</p> : null}
        {details ? (
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => downloadRecoverySnapshot({ startupError: details }, [{ key: 'indexeddb-startup', kind: 'unavailable' }])} className="min-h-11 w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">
              Скачать данные для диагностики
            </button>
            <button type="button" onClick={() => window.location.reload()} className="min-h-11 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">
              Повторить запуск
            </button>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-white">Восстановить из JSON-копии</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">Выберите последнюю резервную копию Neo Finance. Сначала файл будет проверен; текущие данные базы не заменяются до подтверждения.</p>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = '';
                  void handleBackupSelection(file);
                }}
              />
              <button type="button" onClick={() => backupInputRef.current?.click()} disabled={isRestoring} className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Выбрать JSON-файл
              </button>
              {pendingBackup ? (
                <div className="mt-3 rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-xs leading-5 text-mint">Копия проверена: {pendingBackup.data.accounts.length} счетов, {pendingBackup.data.goals.length} целей, {pendingBackup.data.transactions.length} транзакций и {pendingBackup.data.categories.length} категорий.</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-300">Подтверждение заменит содержимое локальной базы данными из выбранной копии.</p>
                  <button type="button" onClick={() => void handleRestore()} disabled={isRestoring} className="mt-3 min-h-11 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50">
                    {isRestoring ? 'Восстанавливаем…' : 'Подтвердить восстановление'}
                  </button>
                  <button type="button" onClick={() => setPendingBackup(null)} disabled={isRestoring} className="mt-2 min-h-9 w-full rounded-xl px-4 py-1 text-xs font-medium text-neutral-300 disabled:opacity-50">
                    Отмена
                  </button>
                </div>
              ) : null}
              {restoreError ? <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-200">{restoreError}</p> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

// Show the real app silhouette immediately. Database initialization remains a gate
// for financial components so no stale LocalStorage values can flash as real balances.
root.render(
  <StrictMode>
    <StartupSkeleton />
  </StrictMode>,
);

// Begin loading every secondary screen while IndexedDB initializes.
void preloadAppScreens();

void initializeDatabaseStorage().then(() => {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}).catch((error: unknown) => {
  const details = error instanceof Error ? error.message : 'Неизвестная ошибка хранилища.';
  root.render(
    <StrictMode>
      <StartupErrorScreen
        message="Приложение остановлено, чтобы не показать пустые или непроверенные данные. Исходные значения LocalStorage не удалялись. Проверьте настройки хранилища браузера и повторите запуск."
        details={details}
      />
    </StrictMode>,
  );
});
