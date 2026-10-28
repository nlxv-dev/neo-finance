import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

const EXIT_DURATION_MS = 300;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  onBackdropClick?: () => void;
  onPanelClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  closeLabel?: string;
  showCloseButton?: boolean;
}

/** Shared animated bottom sheet without custom keyboard shortcuts or focus handling. */
export function BottomSheet({
  open,
  onClose,
  onExited,
  onBackdropClick,
  onPanelClick,
  children,
  ariaLabel = 'Диалоговое окно',
  ariaLabelledBy,
  panelClassName = '',
  panelStyle,
  closeLabel = 'Закрыть',
  showCloseButton = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const hasOpenedRef = useRef(open);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useScrollLock(mounted);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      setMounted(true);
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
      };
    }

    if (!hasOpenedRef.current) return;

    setVisible(false);
    const timeout = window.setTimeout(() => {
      setMounted(false);
      hasOpenedRef.current = false;
      onExitedRef.current?.();
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="bottom-sheet-backdrop"
        className={`fixed inset-0 z-[60] transition-opacity duration-300 gpu ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onBackdropClick ?? onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-hidden={!open}
        onClick={onPanelClick}
        data-testid="bottom-sheet-dialog"
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass overflow-x-hidden transition-all duration-300 ease-out gpu ${
          visible
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        } ${panelClassName}`}
        style={panelStyle}
      >
        <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        </div>

        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset transition-transform active:scale-90 "
            aria-label={closeLabel}
            data-sheet-close="true"
          >
            <X className="h-4 w-4 text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
          </button>
        )}

        {children}
      </div>
    </>
  );
}
