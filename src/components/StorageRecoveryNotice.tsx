import { AlertTriangle, Download, HardDrive } from 'lucide-react';
import type { StorageIssue } from '@/storage/safeLocalStorage';

interface StorageRecoveryNoticeProps {
  issues: StorageIssue[];
  onDownloadRecovery: () => void;
}

const KEY_LABELS: Record<string, string> = {
  'fintrack-transactions': 'Транзакции',
  neo_finance_categories: 'Категории',
  'fintrack-user-name': 'Имя профиля',
  'fintrack-initial-balance': 'Начальный баланс',
  'fintrack-monthly-budget': 'Месячный бюджет',
  'fintrack-theme': 'Тема оформления',
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
  if (issues.length === 0) return null;

  const readIssues = issues.filter((issue) => issue.kind !== 'write-failed');
  const hasCriticalReadIssue = readIssues.length > 0;

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
          <button
            type="button"
            onClick={onDownloadRecovery}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Скачать файл восстановления
          </button>
          <p className="mt-3 text-center text-[11px] leading-4 text-neutral-400 dark:text-neutral-500">
            Файл содержит исходные строки доступных ключей и текущий снимок состояния. Это аварийный файл, не обычная резервная копия.
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
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/70 dark:bg-white/10 dark:text-white"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Скачать восстановительный файл
          </button>
        </div>
      </div>
    </div>
  );
}
