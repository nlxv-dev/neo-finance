# Neo Finance — Dexie Stage 6: Browser Storage Durability

## Scope

This stage improves the app's awareness of browser-managed storage without changing the database schema, adding dependencies, or changing the financial data model.

## Changes

- Persistent-storage permission is no longer requested silently from the root `App` effect. It can be requested explicitly from Settings → Data & Backup, where the user can see what the permission means.
- The Data & Backup screen displays whether persistent storage is granted, not granted, unsupported, or unknown.
- Where supported, it displays the browser's approximate per-origin storage usage and quota. These are diagnostic estimates, not a guarantee of remaining space.
- Browser-storage inspection is isolated in `src/storage/browserStorage.ts`; failures in quota reporting do not block the app.
- Added unit tests for granted/not-granted/unsupported/unknown states, request outcomes, and byte formatting.
- Added a Dexie `versionchange` handler that closes the old connection and reloads the current tab when another running app instance upgrades the database schema.

## Safety semantics

Persistent storage is an eviction-risk reduction, not a backup and not encryption. It does not protect against user-cleared browser data, device loss/failure, malicious scripts running on the origin, or corrupted/imported data. The regular JSON backup remains the primary user-controlled recovery mechanism.

No LocalStorage recovery values are deleted. No Dexie schema version or package dependency changed.

## Manual verification

1. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Open Settings → Data & Backup and confirm the storage state and, where supported, the approximate usage/quota display.
3. Click the persistent-storage request button when it is shown. Confirm the UI reflects the result without blocking the rest of the app if the browser denies or does not support the request.
4. Reload the app and make sure existing transactions, accounts, goals, and settings remain unchanged.
5. Export and re-import a JSON backup as a regression check.

## Known limitations

- Browser storage estimates are browser-provided approximations and may be unavailable.
- Persistence approval differs by browser and may not be available on insecure origins.
- The `versionchange` path is defensive and should be verified with two app tabs during a future schema upgrade; it is not directly exercised by the unit tests in this stage.
- Full lint/typecheck/test/build must be run in the developer environment before accepting this stage.
