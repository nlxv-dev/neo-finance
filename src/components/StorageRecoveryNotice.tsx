import { AlertTriangle, Download, FileJson, HardDrive, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { restoreJsonBackupToStorage, validateBackupFile, type BackupFile } from '@/backup/backupService';
import type { StorageIssue } from '@/storage/safeLocalStorage';
import { STORAGE_KEYS } from '@/storage/storageKeys';

interface StorageRecoveryNoticeProps {
  issues: StorageIssue[];
  onDownloadRecovery: () => void;
}

const KEY_LABELS: Record<string, string> = {
  [STORAGE_KEYS.transactions]: 'Транзакции',
  [STORAGE_KEYS.accounts]: 'Счета',
  [STORAGE_KEYS.goals]: 'Цели',
  [STORAGE_KEYS.categories]: 'Категории',
  [STORAGE_KEYS.userName]: 'Имя профиля',
  [STORAGE_KEYS.initialBalance]: 'Начальный баланс',
  [STORAGE_KEYS.monthlyBudget]: 'Месячный бюджет',
  [STORAGE_KEYS.theme]: 'Тема оформления',
  [STORAGE_KEYS.backgroundStyle]: 'Фон приложения',
};

function getIssueLabel(issue: StorageIssue): string {
  const subject = KEY_LABELS[issue.key] ?? issue.key;
  switch (issue.kind) {
    case 'corrupt-json':
      return `${subject}: сохранённое значение не является корректным JSON.`;
    case 'invalid-data':
      return `${subject}: структура сохранённых данных не прошла проверку.`;
    case 'unavailable':
      return `${subject}: браузерное хранилище недоступно для чтения.`;
    case 'write-failed':
      return `${subject}: браузер не подтвердил запись данных.`;
  }
}

export function StorageRecoveryNotice({ issues, onDownloadRecovery }: StorageRecoveryNoticeProps) {
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  if (issues.length === 0) return null;

  const readIssues = issues.filter((issue) => issue.kind !== 'write-failed');
  const hasCriticalReadIssue = readIssues.length > 0;

  const handleBackupFile = async (file?: File) => {
    setImportError('');
    setPendingBackup(null);
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 50 МБ.');
      const parsed = JSON.parse(await file.text()) as unknown;
      setPendingBackup(validateBackupFile(parsed));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось прочитать резервную копию.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleRestore = async () => {
    if (!pendingBackup) return;
    try {
      await restoreJsonBackupToStorage(pendingBackup);
      window.location.reload();
    } catch (error) {
      setPendingBackup(null);
      setImportError(error instanceof Error ? error.message : 'Не удалось восстановить резервную копию.');
    }
  };

  if (hasCriticalReadIssue) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950/65 px-5 py-8 backdrop-blur-md">
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="storage-recovery-title"
          aria-describedby="storage-recovery-description"
          className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-neutral-950"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id="storage-recovery-title" className="text-lg font-semibold text-neutral-950 dark:text-white">
            Не удалось безопасно прочитать данные
          </h2>
          <p id="storage-recovery-description" className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Neo Finance остановил изменения, чтобы не затереть исходные сохранённые значения. Не очищайте данные сайта.
            Скачайте файл восстановления перед дальнейшими действиями.
          </p>
          <div className="mt-4 rounded-2xl bg-neutral-100 p-3 dark:bg-white/5">
            <ul className="space-y-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
              {readIssues.map((issue) => (
                <li key={`${issue.key}:${issue.kind}`}>{getIssueLabel(issue)}</li>
              ))}
            </ul>
          </div>
          {pendingBackup ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-mint dark:text-mint"><FileJson className="h-4 w-4" /> Резервная копия проверена</div>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">Будут восстановлены {pendingBackup.data.accounts.length} счетов, {pendingBackup.data.goals.length} целей, {pendingBackup.data.transactions.length} транзакций и {pendingBackup.data.categories.length} категорий, а также профиль, бюджет и настройки оформления. Повреждённые локальные значения будут заменены.</p>
              <button type="button" onClick={handleRestore} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-indigoblue px-3 py-2 text-sm font-semibold text-neutral-950"><Upload className="h-4 w-4" /> Восстановить из JSON</button>
            </div>
          ) : (
            <button type="button" onClick={() => importInputRef.current?.click()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 py-3 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]">
              <FileJson className="h-4 w-4" aria-hidden="true" /> Восстановить из JSON-копии
            </button>
          )}
          <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleBackupFile(event.target.files?.[0])} />
          {importError && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-600 dark:text-red-300">{importError}</p>}
          <button type="button" onClick={onDownloadRecovery} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl neu-inset px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            <Download className="h-4 w-4" aria-hidden="true" /> Скачать исходные данные для диагностики
          </button>
          <p className="mt-3 text-center text-[11px] leading-4 text-neutral-400 dark:text-neutral-500">
            Диагностический файл сохраняет исходные строки повреждённых ключей. Он не является обычной резервной копией и не может импортироваться как JSON-бэкап.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-3 top-3 z-[150] mx-auto max-w-md rounded-2xl border border-amber-500/30 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:bg-neutral-950/95">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <HardDrive className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">Не удалось подтвердить сохранение</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            Часть изменений может остаться только в памяти приложения и пропасть после закрытия. Скачайте восстановительный файл.
          </p>
          <ul className="mt-2 space-y-1 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
            {issues.map((issue) => (
              <li key={`${issue.key}:${issue.kind}`}>{getIssueLabel(issue)}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDownloadRecovery}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 transition-transform active:scale-[0.98] dark:bg-white/10 dark:text-white"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Скачать восстановительный файл
          </button>
        </div>
      </div>
    </div>
  );
}
