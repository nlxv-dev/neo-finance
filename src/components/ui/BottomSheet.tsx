import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

const EXIT_DURATION_MS = 300;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    return !element.closest('[hidden], [aria-hidden="true"], .hidden')
      && !element.hasAttribute('disabled')
      && element.getAttribute('aria-disabled') !== 'true';
  });
}

function getInitialFocusElement(container: HTMLElement): HTMLElement {
  const candidates = getFocusableElements(container);
  const preferred = candidates.find((element) => element.hasAttribute('data-sheet-initial-focus'))
    ?? candidates.find((element) => element.matches('input:not([type="hidden"]), textarea, select'));
  return preferred ?? candidates[0] ?? container;
}

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  onEscape?: () => void;
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

/**
 * Shared bottom sheet with delayed unmount, exit animation, focus containment,
 * focus restoration, Escape handling and reference-counted body scroll locking.
 */
export function BottomSheet({
  open,
  onClose,
  onExited,
  onEscape,
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
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);
  const onExitedRef = useRef(onExited);

  onCloseRef.current = onClose;
  onEscapeRef.current = onEscape;
  onExitedRef.current = onExited;

  useScrollLock(mounted);

  useEffect(() => {
    if (open) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body && !panelRef.current?.contains(activeElement)) {
        restoreFocusRef.current = activeElement;
      }

      hasOpenedRef.current = true;
      setMounted(true);
      // Two frames let the browser commit the initial hidden style before transition.
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setVisible(true);
          const panel = panelRef.current;
          if (!panel) return;
          getInitialFocusElement(panel).focus({ preventScroll: true });
        });
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
      };
    }

    if (!hasOpenedRef.current) return;

    // Return focus as soon as the dialog becomes inert/hidden, not after its exit animation.
    const restoreTarget = restoreFocusRef.current;
    if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });

    setVisible(false);
    const timeout = window.setTimeout(() => {
      setMounted(false);
      hasOpenedRef.current = false;
      restoreFocusRef.current = null;
      onExitedRef.current?.();
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const isTopmostDialog = () => {
      const visibleDialogs = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])',
      ));
      return visibleDialogs[visibleDialogs.length - 1] === panel;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog()) return;
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        (onEscapeRef.current ?? onCloseRef.current)();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
      } else if (!panel.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && (activeElement === first || activeElement === panel)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopmostDialog() || panel.contains(event.target as Node)) return;
      getInitialFocusElement(panel).focus({ preventScroll: true });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[60] transition-opacity duration-300 gpu ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onBackdropClick ?? onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-hidden={!open}
        tabIndex={-1}
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
