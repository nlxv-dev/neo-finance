# Neo Finance — Dexie Stage 8: integrity checks and storage ownership

## Purpose

Stage 8 hardens the Stage 7 storage path without changing the Dexie schema, dependencies, financial calculations, or UI layout.

## Changes

- Added `src/storage/databaseIntegrity.ts`, a read-only validator for persisted account, category, goal, and transaction records.
- Startup and consistent database snapshots now verify basic collection structure, the permanent active RUB main account, operation-to-account references, transfer shape/currency constraints, and the relationship between custom category type and operation type.
- The validator reads the migration marker in the same readonly multi-table transaction as the records. Legacy transfers explicitly recorded as unresolved by the one-time migration are preserved rather than rewritten or incorrectly blocking startup.
- Integrity checks never repair financial records. If a stored record violates invariants, reading the snapshot fails with an actionable error and leaves the rows untouched so the user can restore from a known-good JSON backup.
- When Dexie is active, backup download timestamps are written to Dexie only; the old LocalStorage timestamp mirror is retained only for the legacy compatibility path.
- Added regression tests for dangling account references, category/type conflicts, preservation of known unresolved legacy transfers, and immutability of the legacy financial LocalStorage snapshot after Dexie becomes primary.

## LocalStorage ownership notes

- Financial LocalStorage keys are legacy migration input and retained emergency evidence. They are not updated by live Dexie transaction/account/category/goal operations after bootstrap.
- Theme/background values are intentionally mirrored to LocalStorage for the pre-React document paint; Dexie remains the live settings store after bootstrap.
- The legacy hook fallback helpers remain for isolated compatibility tests and legacy utility paths. The production entry point initializes Dexie and only mounts `App` after initialization succeeds; the startup failure screen does not mount the financial hooks.
- Migration and recovery helpers are not removed in this stage, and no old financial keys are deleted.

## Research basis

- Dexie documents transaction rollback on an exception and recommends transactions for related writes: https://dexie.org/docs/Dexie/Dexie.transaction()
- MDN explains that browser storage is best-effort by default and can be evicted; persistent storage is a request, not a backup: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- OWASP explains that IndexedDB is not a confidentiality boundary and should be treated as untrusted input if same-origin scripts can access it: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

## Verification status

Run local ESLint, TypeScript, Vitest, and Vite build checks before accepting this stage. No dependency or schema change is introduced. Expected test count is Stage 7 baseline + 4 new tests (174 total if the Stage 7 baseline remains 170); this is an expectation until the local run confirms it.
