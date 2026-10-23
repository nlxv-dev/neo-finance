import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  validateBackupFile,
} from './backupService';

interface LooseBackup {
  format: string;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  data: {
    transactions: unknown[];
    categories: unknown[];
    profile: {
      userName: string;
      initialBalance: number;
      monthlyBudget: number;
    };
    settings: {
      themeMode: string;
    };
  };
}

function validBackup(): LooseBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'Neo Finance',
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: {
      transactions: [],
      categories: [],
      profile: {
        userName: 'Тест',
        initialBalance: -15_000,
        monthlyBudget: 50_000,
      },
      settings: {
        themeMode: 'dark',
      },
    },
  };
}

describe('validateBackupFile', () => {
  it('accepts a negative initial balance', () => {
    const backup = validateBackupFile(validBackup());

    expect(backup.data.profile.initialBalance).toBe(-15_000);
  });

  it('rejects a non-positive monthly budget', () => {
    const input = validBackup();
    input.data.profile.monthlyBudget = 0;

    expect(() => validateBackupFile(input)).toThrow(/больше нуля/);
  });

  it('rejects an unknown backup format', () => {
    const input = validBackup();
    input.format = 'another-app';

    expect(() => validateBackupFile(input)).toThrow(/поддерживаемого формата/);
  });

  it('rejects an unsupported theme', () => {
    const input = validBackup();
    input.data.settings.themeMode = 'neon';

    expect(() => validateBackupFile(input)).toThrow(/неизвестная тема/);
  });

  it('rejects non-finite transaction amounts', () => {
    const input = validBackup();
    input.data.transactions = [
      {
        id: 1,
        amount: Number.NaN,
        categoryId: null,
        category: 'Продукты',
        categoryIconName: 'ShoppingCart',
        date: '1 янв',
        isIncome: false,
      },
    ];

    expect(() => validateBackupFile(input)).toThrow(/сумма транзакции/);
  });
});
