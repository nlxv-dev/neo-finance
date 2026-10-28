import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { isDynamicImportLoadError } from '@/utils/isDynamicImportLoadError';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunkLoadFailure = isDynamicImportLoadError(this.state.error);

    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent px-5 py-10 text-neutral-900 dark:text-white">
        <section
          role="alert"
          aria-labelledby="app-error-title"
          className="w-full max-w-md rounded-3xl neu-card p-6 text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 id="app-error-title" className="mt-5 text-xl font-semibold tracking-tight">
            {isChunkLoadFailure ? 'Не удалось загрузить экран' : 'Что-то пошло не так'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            {isChunkLoadFailure
              ? 'Возможно, приложение обновилось, а браузер сохранил старую версию одного из файлов. Перезапустите приложение, чтобы загрузить актуальные файлы.'
              : 'Приложение столкнулось с непредвиденной ошибкой. Этот экран не удаляет сохранённые данные из базы.'}
          </p>
          {isChunkLoadFailure ? (
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Незавершённые поля формы могут не сохраниться. Перезагрузка не очищает сохранённые финансовые данные.
            </p>
          ) : null}
          {this.state.error?.message && (
            <details className="mt-4 rounded-2xl neu-inset p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Технические детали
              </summary>
              <p className="mt-2 break-words text-[11px] leading-5 text-neutral-400 dark:text-neutral-500">
                {this.state.error.message}
              </p>
            </details>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 py-3 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98] "
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {isChunkLoadFailure ? 'Перезагрузить приложение' : 'Перезапустить приложение'}
          </button>
        </section>
      </div>
    );
  }
}
