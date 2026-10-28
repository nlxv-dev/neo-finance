# Neo Finance — Dexie Stage 7: stale-migration guard and startup recovery

## Risk addressed

After the LocalStorage → Dexie migration, the old financial LocalStorage keys are intentionally retained but no longer updated. They are an emergency snapshot, not a current replica. If somebody deletes only IndexedDB, the original IndexedDB migration marker disappears while those stale keys can remain. Without a separate guard, startup could silently re-import old transactions and make newer records appear to have vanished.

## Changes

- After successful migration, store a small `neo-finance-dexie-primary-v1` marker in LocalStorage. Existing users already migrated by earlier stages receive this marker on their next successful startup (the existing Dexie marker remains authoritative).
- If the Dexie migration marker is missing but the external marker remains, stop startup instead of importing frozen legacy values. The message explains why automatic rollback is unsafe.
- A startup error screen now lets a user select a regular Neo Finance JSON backup, validates it using the existing backup schema rules, displays its record counts, and requires a separate confirmation before replacing the local database.
- A successful restore writes/replaces the database migration marker in the same Dexie transaction and refreshes the external fence, preventing the next launch from treating the restored database as a first install.
- The external fence is included in the raw diagnostic recovery snapshot. Legacy financial key values are still not modified or removed.

## Safety behaviour

- A valid IndexedDB migration marker still wins; old LocalStorage is not read for data on that fast path.
- If a marker exists outside IndexedDB but the matching IndexedDB marker is gone, automatic legacy import is blocked. Use the latest regular JSON backup instead.
- The external marker write is best-effort because LocalStorage can be unavailable. A write failure does not block a valid Dexie session, but reduces protection against selective manual deletion of IndexedDB.
- If the browser/user clears all origin storage, the app cannot infer prior user data from local state that no longer exists. Only an external JSON backup (or a future remote sync) can recover it.
- IndexedDB is not encrypted by this change.

## Verification requested

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Check: normal startup on an existing Stage 6 database; migration from pre-Dexie LocalStorage; simulation of IndexedDB-only deletion with LocalStorage retained; JSON restore from the startup screen; normal Settings JSON restore; JSON export and CSV import/export.

## Research basis

- Dexie recommends transactional multi-table changes; `transaction()` resolves only when the transaction has committed: https://dexie.org/docs/Dexie/Dexie.transaction()
- MDN explains that browser-managed storage can be evicted and that persistent storage is a request, not a backup: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- OWASP notes that IndexedDB does not provide confidentiality against same-origin JavaScript or users/processes with access to the browser profile, and stored values should be treated as untrusted: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
