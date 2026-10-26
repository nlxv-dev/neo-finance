import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmationPanelProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export function DeleteConfirmationPanel({
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Удалить',
}: DeleteConfirmationPanelProps) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(239, 68, 68, 0.1)' }}
        >
          <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white text-center">
          {title}
        </h2>
        <p className="mt-1.5 text-center text-sm text-neutral-400 dark:text-neutral-500">
          {description}
        </p>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl py-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 neu-card-sm transition-all duration-200 active:scale-[0.98] "
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] "
          style={{ background: 'rgb(239 68 68)' }}
        >
          <Trash2 className="h-4 w-4" />
          {confirmLabel}
        </button>
      </div>
    </>
  );
}
