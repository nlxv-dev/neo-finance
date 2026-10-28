export interface PwaUpdateState {
  updateAvailable: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  error: string | null;
}

export const initialPwaUpdateState: PwaUpdateState = {
  updateAvailable: false,
  offlineReady: false,
  isApplyingUpdate: false,
  error: null,
};

export type PwaUpdateAction =
  | { type: 'update-available' }
  | { type: 'offline-ready' }
  | { type: 'dismiss-update' }
  | { type: 'dismiss-offline-ready' }
  | { type: 'update-started' }
  | { type: 'update-failed'; message: string }
  | { type: 'dismiss-error' };

export function reducePwaUpdateState(
  state: PwaUpdateState,
  action: PwaUpdateAction,
): PwaUpdateState {
  switch (action.type) {
    case 'update-available':
      return {
        updateAvailable: true,
        offlineReady: false,
        isApplyingUpdate: false,
        error: null,
      };
    case 'offline-ready':
      return {
        updateAvailable: false,
        offlineReady: true,
        isApplyingUpdate: false,
        error: null,
      };
    case 'dismiss-update':
      return { ...state, updateAvailable: false, error: null };
    case 'dismiss-offline-ready':
      return { ...state, offlineReady: false };
    case 'update-started':
      return { ...state, isApplyingUpdate: true, error: null };
    case 'update-failed':
      return { ...state, isApplyingUpdate: false, error: action.message };
    case 'dismiss-error':
      return { ...state, error: null };
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}
