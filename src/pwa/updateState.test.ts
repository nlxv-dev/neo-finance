import { describe, expect, it } from 'vitest';
import {
  initialPwaUpdateState,
  reducePwaUpdateState,
  type PwaUpdateState,
} from './updateState';

describe('PWA update state', () => {
  it('starts with no update prompt visible', () => {
    expect(initialPwaUpdateState).toEqual({
      updateAvailable: false,
      offlineReady: false,
      isApplyingUpdate: false,
      error: null,
    });
  });

  it('shows an update prompt and clears a previous error', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, error: 'Offline' };
    expect(reducePwaUpdateState(state, { type: 'update-available' })).toEqual({
      updateAvailable: true,
      offlineReady: false,
      isApplyingUpdate: false,
      error: null,
    });
  });

  it('shows the offline-ready notice without an update prompt', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, updateAvailable: true };
    expect(reducePwaUpdateState(state, { type: 'offline-ready' })).toEqual({
      updateAvailable: false,
      offlineReady: true,
      isApplyingUpdate: false,
      error: null,
    });
  });

  it('dismisses an update without changing other state', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, updateAvailable: true, error: 'Old update error' };
    expect(reducePwaUpdateState(state, { type: 'dismiss-update' })).toEqual({
      ...state,
      updateAvailable: false,
      error: null,
    });
  });

  it('marks the update as applying', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, updateAvailable: true };
    expect(reducePwaUpdateState(state, { type: 'update-started' })).toEqual({
      ...state,
      isApplyingUpdate: true,
      error: null,
    });
  });

  it('exposes a recoverable error if applying the update fails', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, isApplyingUpdate: true };
    expect(reducePwaUpdateState(state, { type: 'update-failed', message: 'Network unavailable' })).toEqual({
      ...state,
      isApplyingUpdate: false,
      error: 'Network unavailable',
    });
  });

  it('can dismiss an update error and retry later', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, error: 'Network unavailable' };
    expect(reducePwaUpdateState(state, { type: 'dismiss-error' })).toEqual({
      ...state,
      error: null,
    });
  });

  it('can dismiss the offline-ready notice', () => {
    const state: PwaUpdateState = { ...initialPwaUpdateState, offlineReady: true };
    expect(reducePwaUpdateState(state, { type: 'dismiss-offline-ready' })).toEqual({
      ...state,
      offlineReady: false,
    });
  });
});
