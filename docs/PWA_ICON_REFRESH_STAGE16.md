# Neo Finance — обновление иконки Stage 16

## Изменение
Заменена тёмная версия иконки на последнюю пользовательскую PNG-версию со светлой жемчужной подложкой и пастельным мятно-голубым знаком.

## Активы
- `public/pwa-192x192.png` — PWA icon / in-app logo.
- `public/pwa-512x512.png` — general PWA icon.
- `public/pwa-512x512-maskable.png` — opaque maskable icon.
- `public/apple-touch-icon.png` — iOS home-screen icon.
- `public/favicon-32x32.png` and `public/favicon.svg` — browser favicons.
- `docs/UX_STAGE16_STARTUP_AND_PWA_ICON.md` — updated note.

The Vite PWA manifest is defined in `vite.config.ts` and already points to these filenames. No manifest changes are necessary. The source image's transparent edges were composited over a warm light matte (`#F5F4F3`) to avoid black transparency rendering in launchers. Icons are opaque raster PNGs at exact declared sizes, consistent with MDN/web.dev guidance on icons and maskable assets.

## Verification performed here
- Source PNG opened and verified as 1024×1024 RGBA.
- All five PNG variants are square, RGB/opaque, and have exact sizes matching filenames and manifest declarations.
- `favicon.svg` parses as XML and its embedded PNG data URI decodes.
- Manifest icon paths in `vite.config.ts` still match the generated filenames.
- ZIP integrity test passed.

Full TypeScript/test/build commands were not run in this environment; only static asset checks were completed. User should run `npm run build` and visually verify PWA/launcher icons after service worker refresh.

## Guidance
- MDN: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons
- MDN manifest icons: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
- Vite PWA static assets: https://vite-pwa-org.netlify.app/guide/static-assets
