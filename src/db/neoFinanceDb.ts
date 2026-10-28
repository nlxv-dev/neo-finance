import Dexie, { type Table } from 'dexie';
import type { Account } from '@/data/accounts';
import type { CustomCategory } from '@/data/categories';
import type { Goal } from '@/data/goals';
import type { Transaction } from '@/data/mockData';
import type { BackgroundStyle, ThemeMode } from '@/data/settings';

export interface ProfileState {
  userName: string;
  monthlyBudget: number;
}

export interface SettingsState {
  themeMode: ThemeMode;
  backgroundStyle: BackgroundStyle;
}

export interface AppStateRecord<T = unknown> {
  key: string;
  value: T;
}

export interface MigrationCounts {
  transactions: number;
  accounts: number;
  categories: number;
  goals: number;
}

export interface LegacyMigrationMarker {
  key: string;
  status: 'completed';
  migrationVersion: 1;
  completedAt: string;
  source: 'localStorage' | 'new-install' | 'backup-restore';
  counts: MigrationCounts;
  /** Rows preserved for history but with account endpoints that old app logic could not safely repair. */
  unresolvedTransferIds: number[];
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

/**
 * Local-first database for Neo Finance.
 * Schema versioning belongs here; product/release versions are independent.
 */
export class NeoFinanceDatabase extends Dexie {
  transactions!: Table<Transaction, number>;
  accounts!: Table<Account, string>;
  categories!: Table<CustomCategory, string>;
  goals!: Table<Goal, string>;
  appState!: Table<AppStateRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(databaseName = 'neo-finance-db') {
    super(databaseName);

    this.version(1).stores({
      // Stable IDs are preserved. No auto-increment key may replace transaction IDs.
      transactions: 'id, dateISO, accountId, toAccountId, categoryId, [accountId+dateISO], [categoryId+dateISO]',
      accounts: 'id, isArchived, currency',
      categories: 'id, [isIncome+isArchived]',
      goals: 'id',
      appState: 'key',
      meta: 'key',
    });

    // An older open tab may still run code for a previous database schema.
    // Close it and reload when another tab upgrades the database, so that this
    // window doesn't continue issuing writes against a stale schema.
    this.on('versionchange', () => {
      this.close();
      if (typeof window !== 'undefined') window.location.reload();
    });
  }
}

export const neoFinanceDb = new NeoFinanceDatabase();
