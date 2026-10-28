import { describe, expect, it, vi } from 'vitest';
import {
  formatStorageBytes,
  readBrowserStorageInfo,
  requestPersistentStorage,
  type BrowserStorageApi,
} from '@/storage/browserStorage';

describe('browser storage safety', () => {
  it('reports persistence and an approximate usage/quota estimate', async () => {
    const storage: BrowserStorageApi = {
      persisted: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockResolvedValue({ usage: 2_097_152, quota: 20_971_520 }),
    };

    await expect(readBrowserStorageInfo(storage)).resolves.toEqual({
      persistence: 'granted',
      usageBytes: 2_097_152,
      quotaBytes: 20_971_520,
    });
  });

  it('reports when persistent storage has not been granted', async () => {
    const storage: BrowserStorageApi = {
      persisted: vi.fn().mockResolvedValue(false),
    };

    await expect(readBrowserStorageInfo(storage)).resolves.toEqual({
      persistence: 'not-granted',
      usageBytes: null,
      quotaBytes: null,
    });
  });

  it('does not fail application startup when storage diagnostics are unsupported', async () => {
    await expect(readBrowserStorageInfo(null)).resolves.toEqual({
      persistence: 'unsupported',
      usageBytes: null,
      quotaBytes: null,
    });
  });

  it('keeps diagnostics available when persistence inspection fails', async () => {
    const storage: BrowserStorageApi = {
      persisted: vi.fn().mockRejectedValue(new Error('blocked')),
      estimate: vi.fn().mockResolvedValue({ usage: 1234, quota: Number.NaN }),
    };

    await expect(readBrowserStorageInfo(storage)).resolves.toEqual({
      persistence: 'unknown',
      usageBytes: 1234,
      quotaBytes: null,
    });
  });

  it('requests persistence when needed and does not request it twice when already granted', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const requestable: BrowserStorageApi = {
      persisted: vi.fn().mockResolvedValue(false),
      persist,
    };
    await expect(requestPersistentStorage(requestable)).resolves.toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);

    const alreadyGranted: BrowserStorageApi = {
      persisted: vi.fn().mockResolvedValue(true),
      persist,
    };
    await expect(requestPersistentStorage(alreadyGranted)).resolves.toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('handles denied, unsupported, and throwing requests without rejecting', async () => {
    await expect(requestPersistentStorage(null)).resolves.toBe('unsupported');
    await expect(requestPersistentStorage({ persisted: vi.fn().mockResolvedValue(false) })).resolves.toBe('unsupported');
    await expect(requestPersistentStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    })).resolves.toBe('denied');
    await expect(requestPersistentStorage({
      persisted: vi.fn().mockRejectedValue(new Error('blocked')),
      persist: vi.fn(),
    })).resolves.toBe('denied');
  });

  it('formats storage amounts and handles unknown estimates', () => {
    expect(formatStorageBytes(500)).toBe('500 Б');
    expect(formatStorageBytes(1024)).toBe('1 КБ');
    expect(formatStorageBytes(1_572_864)).toBe('1,5 МБ');
    expect(formatStorageBytes(null)).toBeNull();
  });
});
