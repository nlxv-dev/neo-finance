# Neo Finance — Dexie Stage 3: reactive state

## Purpose

Stage 2 made Dexie the persisted store and gated application startup on database initialization. Stage 3 adds reactive reads so mounted React hooks can observe changes made through Dexie after startup, rather than treating the initial bootstrap snapshot as their only view of stored data.

## Changes

- Added ordered Dexie query functions for transactions, accounts, categories and goals. Each query reads both the collection and its order metadata in one read transaction.
- Added live profile/settings queries for the profile fields and main-account opening balance, plus theme/background settings.
- Connected transaction, account, category, goal, profile and theme hooks to `dexie-react-hooks` `useLiveQuery()`.
- Collection mutations request persistence directly from their commit path through `databaseStorage.ts`; LocalStorage write effects remain only for the legacy-only path used by isolated tests/recovery helpers.
- Added a guard around pending local writes and a fresh read after the queue drains so an earlier live-query result cannot replace a newer optimistic state update from the same hook.
- Added a test for a mounted transaction hook receiving an update made directly through the Dexie table API.
- Corrected startup copy from “защищённое хранилище” to “подготавливаем хранилище”; Dexie/IndexedDB does not, by itself, encrypt data.

## Remaining work / limitations

- Collection-level persistence APIs still support full collection replacement for ordinary hook writes. A future stage should introduce targeted add/update/delete repository commands to minimize writes and better reconcile simultaneous edits from multiple tabs.
- This stage observes changes made through Dexie. Direct edits through browser DevTools or another IndexedDB wrapper are not guaranteed to trigger Dexie live queries.
- LocalStorage transaction/account/category/goal values are intentionally retained as a recovery source; they must not be cleared automatically.
- The pre-React theme/background LocalStorage mirrors remain because `index.html` applies them before IndexedDB can open.
- Browser persistent storage is requested on startup, but granting it is browser-dependent. This is not encryption and not a substitute for backups.
- Dexie/IndexedDB is scoped to the same browser origin; this does not provide cross-device synchronization.

## Verification status

- TypeScript transpilation/syntax check: **89 TS/TSX files, zero transpilation diagnostics**.
- Full ESLint, `tsc --noEmit`, Vitest and Vite production build: **not verified for Stage 3** in the preparation environment because npm dependencies could not be installed completely. The user-confirmed Stage 2 test results do not validate this Stage 3 change.

After applying the files, run from the project root:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run dev -- --host
```

Then verify that old transactions appear, a new transaction survives restart, JSON backup restore works, CSV import remains functional, and the app settings still persist. Keep an external JSON backup and do not clear LocalStorage or IndexedDB while validating.

## Official documentation

- Dexie React integration: https://dexie.org/docs/Tutorial/React
- `useLiveQuery()`: https://dexie.org/docs/dexie-react-hooks/useLiveQuery%28%29
- Dexie transaction best practices: https://dexie.org/docs/Tutorial/Best-Practices
