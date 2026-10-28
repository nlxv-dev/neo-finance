# Stage 11 — recovery guidance for lazy-loaded assets

## Why

Stage 10 introduced lazy-loaded screens. A browser tab can retain an older HTML/JavaScript version while a deployment no longer serves one of that version's hashed dynamic chunks. Vite documents this class of version-skew failure as a possible `Failed to fetch dynamically imported module` error.

References:

- Vite troubleshooting: https://github.com/vitejs/vite/blob/main/docs/guide/troubleshooting.md
- Vite PWA automatic updates: https://vite-pwa-org.netlify.app/guide/auto-update

## Changes

- Added `src/utils/isDynamicImportLoadError.ts` to recognize common dynamic-module, module-script, chunk and CSS-preload failures without treating generic errors as chunk errors.
- Added tests for current browser wording, CSS preload failures, legacy chunk errors and unrelated errors.
- Updated `ErrorBoundary` to distinguish likely stale/missing lazy assets and explain that the user can reload to get current files.
- Kept recovery manual. A finance app may have forms with values not yet saved to Dexie; automatic reload could discard that in-memory input without giving the user a choice.
- Clarified that the error screen itself does not delete saved database values, but unsaved form fields may be lost.

## Scope

No dependency, Dexie schema, LocalStorage migration, financial calculation or PWA service-worker configuration changes.

## Validation

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Then open Statistics, Wallet, Goals and Settings in the built preview. The rare stale-chunk failure scenario should only be simulated in a disposable browser profile, not by deleting storage from the primary profile.
