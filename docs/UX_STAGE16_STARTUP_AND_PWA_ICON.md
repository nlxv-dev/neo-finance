# Neo Finance Stage 16 report

## Objective
Improve first-launch UX and replace the placeholder F icon with the user-supplied app artwork, following current PWA icon guidance.

## Implementation
- Normal boot now shows a visual skeleton based on the app's own layout; the text-based StartupScreen is no longer used on successful startup.
- Database initialization still gates mounting financial React hooks, preventing old LocalStorage values from briefly appearing as real balances.
- Secondary screen chunk imports are started in parallel with database initialization, with cached promises shared by React.lazy.
- A skeleton fallback is also used if a screen chunk has not finished loading.
- PWA icons were regenerated as opaque PNGs from the user's supplied PNG (preferred over their JPEG variant because JPEG has a white matte). Manifest entries keep 192x192 and 512x512 assets and the separate maskable entry. Favicon and Apple touch icon now show the same icon.
- The app logo in HomeScreen and the genuine startup recovery screen now use the same new icon.
- The recovery screen remains available for actual database initialization failures; only the normal loading message was removed.

## Source guidance
- MDN: PWA icons should be provided as a set of assets with `src`, exact `sizes`, MIME `type`, and optional `purpose`; 192x192 and 512x512 are important Chromium installability sizes. The central 80% is the maskable safe zone.
- web.dev: opaque square icons are more interoperable than transparent PNGs on some OS surfaces; provide raster fallback icons.
- React docs: `lazy()` loads modules on first render; cached dynamic-import promises can preload those modules before the user's first tap.

## Verification status
- Source/asset changes prepared and source archive structure checked.
- PNGs are opaque, square, and match their declared sizes.
- Manifest JSON/object configuration inspected for correct asset names.
- Full ESLint, TypeScript typecheck, Vitest, and production build have not been run in this environment; run them locally before treating Stage 16 as verified.
