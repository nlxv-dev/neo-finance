/**
 * Browser-managed storage capabilities for the local-first Neo Finance app.
 * The Storage API is advisory: persistence reduces automatic eviction risk but
 * does not replace exports and does not protect data against manual clearing,
 * device loss, or malicious scripts running in the same origin.
 */
export type BrowserPersistenceState = 'granted' | 'not-granted' | 'unsupported' | 'unknown';
export type PersistentStorageRequestResult = 'granted' | 'denied' | 'unsupported';

export interface BrowserStorageInfo {
  persistence: BrowserPersistenceState;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export interface BrowserStorageApi {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

function getBrowserStorageApi(): BrowserStorageApi | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.storage ?? null;
}

function validByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Reads storage permission and an approximate per-origin usage/quota estimate. */
export async function readBrowserStorageInfo(
  storage: BrowserStorageApi | null = getBrowserStorageApi(),
): Promise<BrowserStorageInfo> {
  if (!storage) {
    return { persistence: 'unsupported', usageBytes: null, quotaBytes: null };
  }

  let persistence: BrowserPersistenceState = 'unsupported';
  if (typeof storage.persisted === 'function') {
    try {
      persistence = (await storage.persisted()) ? 'granted' : 'not-granted';
    } catch {
      persistence = 'unknown';
    }
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (typeof storage.estimate === 'function') {
    try {
      const estimate = await storage.estimate();
      usageBytes = validByteCount(estimate.usage) ? estimate.usage : null;
      quotaBytes = validByteCount(estimate.quota) ? estimate.quota : null;
    } catch {
      // Quota estimates are optional diagnostics; failure must not block app use.
    }
  }

  return { persistence, usageBytes, quotaBytes };
}

/**
 * Requests persistent origin storage only when explicitly called by the user.
 * Browsers may deny the request or do nothing, so callers must still recommend
 * regular JSON backups.
 */
export async function requestPersistentStorage(
  storage: BrowserStorageApi | null = getBrowserStorageApi(),
): Promise<PersistentStorageRequestResult> {
  if (!storage || typeof storage.persisted !== 'function') return 'unsupported';

  try {
    if (await storage.persisted()) return 'granted';
    if (typeof storage.persist !== 'function') return 'unsupported';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function formatStorageBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}
