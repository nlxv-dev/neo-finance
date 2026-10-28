# Neo Finance — Dexie Stage 4: targeted collection writes

## Goal

Routine changes from the transaction, account, category and goal hooks should persist only the records that changed. A stale React snapshot must not cause an unrelated row added by another tab to be deleted.

## Behaviour

- The hooks pass both the previous and next collection snapshots to the persistence layer.
- The storage layer calculates inserted, updated and removed IDs and writes only those rows inside one Dexie read/write transaction.
- Before updating or deleting an existing record, the stored row is compared with the value the caller originally read. If that same record has changed in the database, the transaction aborts rather than silently overwriting the newer value.
- New IDs are checked for collisions before writing.
- Collection-order metadata is updated only for insertions/deletions. Ordinary field updates do not rewrite order metadata or unnecessarily invalidate other collection readers.
- The order merge retains unrelated IDs already present in database metadata, including rows added by another tab.
- Intentional full replacements (JSON restore and CSV import) remain separate, all-or-nothing import paths. The optional one-argument `persistX(rows)` form remains for explicit full replacement/testing; the normal React hooks use `persistX(rows, previousRows)`.

## Tests added

`src/storage/databaseStorage.test.ts` now checks:

1. an edit to one transaction doesn't delete an unrelated row added directly to Dexie;
2. a stale edit to the same row is rejected and the newer stored value survives;
3. deleting one transaction doesn't delete a separate row added by another tab.

## Known limitation

This is optimistic conflict detection, not automatic merge. If the exact same record changes elsewhere between read and write, the stale write is rejected and the hook refreshes from Dexie using the existing storage-error handling. The user may need to repeat the intended edit. Field-level merge, explicit conflict messaging, and cross-tab conflict UX are future work.

LocalStorage recovery copies remain in place. Do not manually clear LocalStorage or IndexedDB during validation.

## Validation

The preparation environment could not complete `npm ci` because the install stalled on network access. Syntax/transpilation checks passed for all six modified TypeScript files. Full ESLint, TypeScript typecheck, Vitest and production build must be run in the project environment before this patch is accepted.
