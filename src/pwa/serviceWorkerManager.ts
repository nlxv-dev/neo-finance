import { registerSW } from 'virtual:pwa-register';
import {
  initialPwaUpdateState,
  reducePwaUpdateState,
  type PwaUpdateAction,
  type PwaUpdateState,
} from './updateState';

type UpdateServiceWorker = (reloadPage?: boolean) => void | Promise<void>;

let state: PwaUpdateState = initialPwaUpdateState;
let updateServiceWorker: UpdateServiceWorker | null = null;
let registrationStarted = false;
const listeners = new Set<() => void>();

function dispatch(action: PwaUpdateAction) {
  const nextState = reducePwaUpdateState(state, action);
  if (
    nextState.updateAvailable === state.updateAvailable &&
    nextState.offlineReady === state.offlineReady &&
    nextState.isApplyingUpdate === state.isApplyingUpdate &&
    nextState.error === state.error
  ) {
    return;
  }

  state = nextState;
  listeners.forEach((listener) => listener());
}

export function subscribePwaUpdateState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaUpdateSnapshot(): PwaUpdateState {
  return state;
}

export function startPwaServiceWorkerRegistration(): void {
  // The Vite dev server deliberately keeps service-worker support disabled.
  // Register only the production PWA, where hashed assets and update prompts matter.
  if (!import.meta.env.PROD || typeof window === 'undefined' || registrationStarted) return;
  registrationStarted = true;

  try {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => dispatch({ type: 'update-available' }),
      onOfflineReady: () => dispatch({ type: 'offline-ready' }),
      onRegisterError: (error: unknown) => {
        // A registration failure should not block a locally stored finance app.
        console.warn('Neo Finance could not register its service worker.', error);
      },
    });
  } catch (error) {
    console.warn('Neo Finance could not start service-worker registration.', error);
  }
}

export async function applyPwaUpdate(): Promise<void> {
  if (state.isApplyingUpdate) return;
  if (!updateServiceWorker) {
    dispatch({
      type: 'update-failed',
      message: 'Обновление сейчас недоступно. Проверьте подключение и попробуйте позже.',
    });
    return;
  }

  dispatch({ type: 'update-started' });
  try {
    // An explicit user action activates the waiting worker and permits reload.
    await updateServiceWorker(true);
  } catch (error) {
    console.error('Neo Finance could not apply its service-worker update.', error);
    dispatch({
      type: 'update-failed',
      message: 'Не удалось применить обновление. Проверьте подключение и попробуйте ещё раз позже.',
    });
  }
}

export function dismissPwaUpdate(): void {
  dispatch({ type: 'dismiss-update' });
}

export function dismissPwaOfflineReady(): void {
  dispatch({ type: 'dismiss-offline-ready' });
}

export function dismissPwaUpdateError(): void {
  dispatch({ type: 'dismiss-error' });
}
