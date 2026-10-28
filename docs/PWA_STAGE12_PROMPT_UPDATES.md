# Neo Finance — Stage 12: controlled PWA updates

## Why

Stage 11 introduced a manual recovery action for stale lazy-loaded chunks, but `vite.config.ts` still configured `registerType: 'autoUpdate'`. Neo Finance contains forms with values that can exist only in React state before the user saves. The Vite PWA documentation warns that automatic update/reload behavior can discard such input and recommends a prompt when an application has forms.

References:

- https://vite-pwa-org.netlify.app/guide/prompt-for-update
- https://vite-pwa-org.netlify.app/guide/auto-update
- https://web.dev/learn/pwa/update

## Changes

- Switched `VitePWA.registerType` from `autoUpdate` to `prompt`.
- Added explicit `registerSW()` registration using `virtual:pwa-register` in production builds only; the dev server remains service-worker-disabled.
- Added a non-blocking update banner with `Позже` and `Обновить` actions. The page reload occurs only after the user chooses to update.
- Added a dismissible offline-ready notice and recoverable UI if applying an update fails.
- Uses `useSyncExternalStore` over a small external state manager to avoid registering the worker from a React effect (and duplicate setup in StrictMode).
- Added reducer tests for update prompt, offline-ready state, dismissal, apply and error handling.
- No database schema, financial calculations, dependencies or backup format changes.

## Validation

Full commands to run in the project environment:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run dev -- --host
```

The service worker is intentionally disabled in development (`devOptions.enabled: false`), so the update prompt does not appear under `npm run dev -- --host`. To verify actual service-worker registration, use a production build with `npm run preview -- --host` or the deployed PWA. To see the update prompt, publish a second build while keeping an older PWA instance open; do not simulate this by deleting IndexedDB or LocalStorage.

Stage 11 had an expected 192 tests. Eight reducer tests are added; 200 tests are expected if the existing suite was unchanged. This is an expected count until Vitest is run in the project environment.
