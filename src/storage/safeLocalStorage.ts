export type StorageIssueKind =
  | 'corrupt-json'
  | 'invalid-data'
  | 'unavailable'
  | 'write-failed';

export interface StorageIssue {
  key: string;
  kind: StorageIssueKind;
  /** The original stored value, when it could be read. Never overwrite it automatically. */
  rawValue?: string;
}

export type StorageReadStatus = 'missing' | 'valid' | 'corrupt' | 'unavailable';

export interface StorageReadResult<T> {
  value: T;
  status: StorageReadStatus;
  issue?: StorageIssue;
  rawValue?: string;
}

export type RawStorageReadResult =
  | { status: 'missing' }
  | { status: 'present'; value: string }
  | { status: 'unavailable'; issue: StorageIssue };

const RECOVERY_KEYS = [
  'fintrack-transactions',
  'fintrack-accounts',
  'fintrack-goals',
  'neo_finance_categories',
  'fintrack-user-name',
  'fintrack-initial-balance',
  'fintrack-monthly-budget',
  'fintrack-theme',
  'fintrack-background-style',
] as const;

export function readRawStorageValue(key: string): RawStorageReadResult {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? { status: 'missing' } : { status: 'present', value };
  } catch {
    return {
      status: 'unavailable',
      issue: { key, kind: 'unavailable' },
    };
  }
}

export function readStoredJson<T>(
  key: string,
  fallback: T,
  normalize: (parsed: unknown) => T | null
): StorageReadResult<T> {
  const raw = readRawStorageValue(key);
  if (raw.status === 'missing') return { value: fallback, status: 'missing' };
  if (raw.status === 'unavailable') {
    return { value: fallback, status: 'unavailable', issue: raw.issue };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.value) as unknown;
  } catch {
    return {
      value: fallback,
      status: 'corrupt',
      rawValue: raw.value,
      issue: { key, kind: 'corrupt-json', rawValue: raw.value },
    };
  }

  try {
    const normalized = normalize(parsed);
    if (normalized === null) {
      return {
        value: fallback,
        status: 'corrupt',
        rawValue: raw.value,
        issue: { key, kind: 'invalid-data', rawValue: raw.value },
      };
    }

    return { value: normalized, status: 'valid', rawValue: raw.value };
  } catch {
    return {
      value: fallback,
      status: 'corrupt',
      rawValue: raw.value,
      issue: { key, kind: 'invalid-data', rawValue: raw.value },
    };
  }
}

export function readStoredString(key: string, fallback: string): StorageReadResult<string> {
  const raw = readRawStorageValue(key);
  if (raw.status === 'missing') return { value: fallback, status: 'missing' };
  if (raw.status === 'unavailable') {
    return { value: fallback, status: 'unavailable', issue: raw.issue };
  }
  return { value: raw.value, status: 'valid', rawValue: raw.value };
}

export function readStoredNumber(
  key: string,
  fallback: number,
  validate: (value: number) => boolean = Number.isFinite
): StorageReadResult<number> {
  const raw = readRawStorageValue(key);
  if (raw.status === 'missing') return { value: fallback, status: 'missing' };
  if (raw.status === 'unavailable') {
    return { value: fallback, status: 'unavailable', issue: raw.issue };
  }

  const parsed = raw.value.trim() === '' ? Number.NaN : Number(raw.value);
  if (!Number.isFinite(parsed) || !validate(parsed)) {
    return {
      value: fallback,
      status: 'corrupt',
      rawValue: raw.value,
      issue: { key, kind: 'invalid-data', rawValue: raw.value },
    };
  }

  return { value: Math.round(parsed), status: 'valid', rawValue: raw.value };
}

export function canPersistReadStatus(status: StorageReadStatus): boolean {
  return status === 'missing' || status === 'valid';
}

export function writeStoredRawValue(key: string, value: string): StorageIssue | null {
  try {
    window.localStorage.setItem(key, value);
    return null;
  } catch {
    return { key, kind: 'write-failed' };
  }
}

export function writeStoredJson(key: string, value: unknown): StorageIssue | null {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') return { key, kind: 'write-failed' };
    window.localStorage.setItem(key, serialized);
    return null;
  } catch {
    return { key, kind: 'write-failed' };
  }
}

export type PersistentStorageStatus = 'unsupported' | 'granted' | 'denied';

/**
 * Просит браузер сохранить данные origin при нехватке места.
 * Браузер может проигнорировать или отклонить запрос, поэтому это best-effort.
 */
export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage?.persist ||
      !navigator.storage?.persisted
    ) {
      return 'unsupported';
    }

    if (await navigator.storage.persisted()) {
      return 'granted';
    }

    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function snapshotRawStorage(): Record<string, { status: 'missing' | 'present' | 'unavailable'; value?: string }> {
  const snapshot: Record<string, { status: 'missing' | 'present' | 'unavailable'; value?: string }> = {};

  for (const key of RECOVERY_KEYS) {
    const result = readRawStorageValue(key);
    if (result.status === 'present') snapshot[key] = { status: 'present', value: result.value };
    else snapshot[key] = { status: result.status };
  }

  return snapshot;
}

/** Downloads a user-triggered recovery bundle containing both the in-memory snapshot and raw storage values. */
export function downloadRecoverySnapshot(
  currentState: unknown,
  issues: StorageIssue[]
): void {
  const payload = {
    format: 'neo-finance-recovery',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    note: 'Recovery snapshot. Raw storage strings are preserved as-is; this is not the regular import-backup format.',
    issues: issues.map(({ key, kind }) => ({ key, kind })),
    currentState,
    rawStorage: snapshotRawStorage(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `neo-finance-recovery-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
