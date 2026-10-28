# Neo Finance — Local-first storage architecture (through Stage 8)

**Current baseline:** The user reported successful command and app checks through Stage 7. Stage 8 adds read-only integrity checks before snapshots are exposed and keeps the active backup timestamp in Dexie instead of the frozen legacy LocalStorage snapshot.

## Current architecture

- `src/db/neoFinanceDb.ts` defines the IndexedDB/Dexie schema. Schema version and product release version are separate.
- `src/storage/legacyStorageMigration.ts` validates and imports the old LocalStorage data set once, with table writes and its Dexie marker committed atomically.
- `src/storage/databaseStorage.ts` is the application storage service: bootstrap and backup reads use consistent readonly transactions, explicit JSON restore is atomic, and collection updates use per-record deltas with stale-write guards.
- React hooks subscribe through `useLiveQuery()` to rows in Dexie and submit changes through the storage service. A write conflict against the same row is rejected instead of silently overriding a newer value.
- `appState.collectionOrder` stores list order explicitly; IndexedDB primary-key ordering is not treated as product/UI ordering.
- JSON backup remains the user-controlled recovery mechanism. CSV remains a transaction-focused import/export format.

## Dexie schema v1

| Table | Primary key | Indexes |
|---|---|---|
| `transactions` | existing numeric `id` | `dateISO`, `accountId`, `toAccountId`, `categoryId`, `[accountId+dateISO]`, `[categoryId+dateISO]` |
| `accounts` | string `id` | `isArchived`, `currency` |
| `categories` | string `id` | `[isIncome+isArchived]` |
| `goals` | string `id` | none beyond primary key |
| `appState` | string `key` | none beyond primary key |
| `meta` | string `key` | none beyond primary key |

`appState` currently holds profile, theme/background settings, list-order metadata and last-backup timestamp. `meta` holds the migration/initialization marker. A version upgrade is required only when the IndexedDB schema changes; visual/product version strings do not change the database version.

## Canonical data rules

1. `accounts[acc-main].initialBalance` is the canonical opening balance.
2. Imported transactions and transfers are validated against the account model before writes are committed.
3. Full JSON restore replaces transactions, accounts, categories, goals and related state in one transaction. A failed write should roll back the transaction instead of leaving a partial restore.
4. CSV import validates account references and uses one transaction for its transaction/category/order changes. JSON is preferred when transferring accounts, currencies, goals, settings and transfers between devices.
5. Legacy finance values in LocalStorage are retained and are no longer updated after successful migration. They must not be silently re-imported as if they were a current copy.
6. Stage 7 adds a separate best-effort LocalStorage authority marker. When it exists without the Dexie marker, startup stops rather than silently restoring a stale legacy snapshot. The startup screen accepts a validated regular JSON backup and asks for confirmation before replacing the local database.
7. The theme mode and background style have tiny LocalStorage mirrors so `index.html` can apply them before React/IndexedDB initialize. Dexie remains the canonical source once bootstrap succeeds.
8. Stage 8 runs a read-only integrity audit on a consistent database snapshot. It validates records and account/transfer/category relationships without repairing rows. Known unresolved legacy transfers are exempt only when listed by the migration marker.
9. The last-backup timestamp is stored in Dexie when the database is primary. The legacy LocalStorage timestamp is retained only for the compatibility path.
10. Do not automatically clear IndexedDB or old LocalStorage keys as part of startup or migration.

## Browser durability and security

- `navigator.storage.persist()` is a best-effort browser request, not a guarantee and not a backup. Browser quotas and eviction vary by browser/device.
- Storage usage/quota estimates are approximate. A browser can deny persistence and the application should remain usable.
- IndexedDB does not encrypt financial records or defend against same-origin malicious JavaScript. Imported/stored values require validation.
- If all storage for the site is cleared, a fully local app cannot infer the user's previous data from storage that no longer exists. Only an external JSON backup or a future sync service can restore those records.
- A successful JSON restore also writes the Dexie migration marker, so the next startup will not treat the restored database as a first install.

## Verification status

The user reported successful `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, app startup, transaction writes, account/transfer checks, restart persistence, and JSON export/import through Stage 7. Stage 7 was reported working in the user environment; the rare selective-IndexedDB-loss scenario was not run manually and remains an optional isolated recovery test. Stage 8 adds four regression cases; an unchanged Stage 7 suite of 170 tests should become 174, pending the local run.

After each coordinated patch, run in `C:\Projects`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run dev -- --host
```

Stage 7’s destructive recovery-path test remains optional and should only be performed on a disposable browser profile after making an external JSON backup. Stage 8’s new automated tests cover corrupted references and preservation of the frozen legacy LocalStorage snapshot.

## Not in scope yet

- Cloud sync or shared multi-device data.
- Encryption at rest.
- Native SQLite/Capacitor migration.
- Removing legacy LocalStorage finance values. That should only be considered after longer field validation and a documented recovery decision.
