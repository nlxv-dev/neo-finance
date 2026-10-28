import { describe, expect, it } from 'vitest';
import { isDynamicImportLoadError } from '@/utils/isDynamicImportLoadError';

describe('isDynamicImportLoadError', () => {
  it('recognizes the browser message for a missing dynamic module', () => {
    expect(isDynamicImportLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/StatisticsScreen-old.js'))).toBe(true);
  });

  it('recognizes module script loading failures', () => {
    expect(isDynamicImportLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isDynamicImportLoadError(new Error('Failed to load module script: expected JavaScript module'))).toBe(true);
  });

  it('recognizes Vite CSS preload errors', () => {
    expect(isDynamicImportLoadError(new Error('Unable to preload CSS for /assets/StatisticsScreen-old.css'))).toBe(true);
  });

  it('recognizes legacy chunk-loading error messages', () => {
    expect(isDynamicImportLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
    expect(isDynamicImportLoadError(new Error('ChunkLoadError: Loading chunk failed'))).toBe(true);
  });

  it('accepts plain error strings', () => {
    expect(isDynamicImportLoadError('Error loading dynamically imported module')).toBe(true);
  });

  it('does not classify unrelated application errors as asset failures', () => {
    expect(isDynamicImportLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isDynamicImportLoadError(new Error('Network request failed'))).toBe(false);
  });

  it('safely handles empty or unknown error values', () => {
    expect(isDynamicImportLoadError(null)).toBe(false);
    expect(isDynamicImportLoadError(undefined)).toBe(false);
    expect(isDynamicImportLoadError({ code: 'ERR_FAILED' })).toBe(false);
  });
});
