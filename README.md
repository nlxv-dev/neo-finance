# Neo Finance — universal app icon update

This update replaces the previously referenced icon assets with newly named square images, without a baked-in iOS superellipse or rounded border. The operating system/browser can apply its own shape mask. It also updates the PWA manifest icon URLs so Chrome has a changed URL to discover, rather than seeing only new pixels at an old path.

## Files

- `index.html` — references the new favicon and Apple touch icon.
- `vite.config.ts` — uses new PWA `any` and `maskable` icons.
- `src/components/HomeScreen.tsx` — updates the small app mark next to “Добро пожаловать”; it previously still referenced the old `pwa-192x192.png`.
- `public/*.png` — six replacement icon images in their required sizes.
- `NeoFinance_Icon_Artwork.png` — full square master artwork.

## Apply

1. Make a backup or commit your current local state first.
2. Copy `index.html` and `vite.config.ts` from this package into the project root, replacing those two files.
3. Copy `src/components/HomeScreen.tsx` from this package to the same path in your project, replacing the existing file.
4. Copy all PNG files in this package's `public` folder into your project's `public` folder. Keep the old icon files for now; they are no longer referenced by these updated files.
5. From the project root run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
6. Inspect the generated `dist/manifest.webmanifest` and verify that it references `pwa-icon-v2-192.png`, `pwa-icon-v2-512.png`, and `pwa-icon-v2-maskable-512.png`.
7. Review `git status` and the diff. Commit and push manually when satisfied.

## Important data note

This change only touches the page metadata, PWA configuration, and icon assets. It does not modify Dexie/IndexedDB code or transaction data. Still, keep a current JSON backup before deployment as normal practice.

## Validation status

The image dimensions and archive contents were checked. The full app source is not included, so the project lint/typecheck/tests/build have not been run here. The HomeScreen change only updates the image path to the new asset name.
