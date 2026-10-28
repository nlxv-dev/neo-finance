# Neo Finance — Dexie Stage 5: consistent snapshots and exports

## Goal

Use IndexedDB/Dexie as the authoritative source for backups and CSV exports, and avoid reading application tables at different moments during initialization.

## Changes

- Added `readConsistentDatabaseSnapshot()`, which reads transactions, accounts, categories, goals, app state, collection order, profile, settings, and backup metadata inside one readonly Dexie transaction.
- `initializeDatabaseStorage()` now uses that same consistent snapshot reader before React mounts.
- Export code can call `readCurrentDatabaseSnapshot()` to get fresh database data instead of the startup snapshot or potentially stale React props.
- JSON backup generation now has `createDatabaseBackupFile()` and `downloadJsonBackupFromDatabase()`. The Settings screen uses this path when Dexie is initialized.
- CSV export now reads current transaction rows and their persisted order through `queryDatabaseTransactions()` rather than exporting the component's transaction array.
- `downloadJsonBackup()` remains as a synchronous compatibility path for legacy/isolation tests.
- No Dexie schema version or dependencies changed. No UI redesign was made.

## Verification

- Static TypeScript/TSX transpilation: 89 source files processed, zero syntax diagnostics.
- Full ESLint, TypeScript typecheck, Vitest, and production build were not run in this preparation environment. `npm ci --offline` could not complete because `yocto-queue` was absent from the local npm cache; an online install attempt timed out. The partial `node_modules` directory created by the timed-out attempt is not part of the delivery archives.
- One test was added to verify that both the consistent snapshot and JSON backup builder observe current Dexie values rather than stale bootstrap values. The expected suite count is 161 after applying Stage 5 to the verified Stage 4 baseline (160 tests).

## Apply and validate

Apply only the files listed in the Stage 5 changed-files archive to the Stage 4 project, keeping relative paths. Then run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run dev -- --host
```

Manually re-test JSON export/import and CSV export. Do not clear LocalStorage or IndexedDB during validation; LocalStorage is still retained as a recovery source.
