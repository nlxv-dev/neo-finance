import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { STORAGE_KEYS } from '@/storage/storageKeys';
import { getDatabaseBootstrapSnapshot, hasDatabaseBootstrap, persistSettings, queryDatabaseSettings } from '@/storage/databaseStorage';
import type { BackgroundStyle, ThemeMode } from '@/data/settings';
export type { BackgroundStyle, ThemeMode } from '@/data/settings';

type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = STORAGE_KEYS.theme;
const BACKGROUND_STYLE_STORAGE_KEY = STORAGE_KEYS.backgroundStyle;

function isThemeMode(value: string | undefined | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isBackgroundStyle(value: string | undefined | null): value is BackgroundStyle {
  return value === 'gradient' || value === 'solid';
}

function readInitialBackgroundStyle(): BackgroundStyle {
  const databaseStyle = getDatabaseBootstrapSnapshot()?.settings.backgroundStyle;
  if (databaseStyle && isBackgroundStyle(databaseStyle)) return databaseStyle;

  // index.html restores this before React starts, avoiding a first-frame gradient flash.
  const initializedStyle = document.documentElement.dataset.backgroundStyle;
  if (isBackgroundStyle(initializedStyle)) return initializedStyle;
  try {
    const storedStyle = window.localStorage.getItem(BACKGROUND_STYLE_STORAGE_KEY);
    if (isBackgroundStyle(storedStyle)) return storedStyle;
  } catch {
    // The default remains the current gradient design when storage is unavailable.
  }
  return 'gradient';
}

function readInitialThemeMode(): ThemeMode {
  const databaseMode = getDatabaseBootstrapSnapshot()?.settings.themeMode;
  if (databaseMode && isThemeMode(databaseMode)) return databaseMode;

  // index.html applies the stored theme before React starts, preventing a first-frame flash.
  const initializedMode = document.documentElement.dataset.themeMode;
  if (isThemeMode(initializedMode)) return initializedMode;
  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(storedMode)) return storedMode;
  } catch {
    // Storage can be unavailable in restricted browsing contexts; use the light default.
  }
  return 'light';
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readInitialThemeMode);
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>(readInitialBackgroundStyle);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const didInitializePersistence = useRef(false);
  const liveSettings = useLiveQuery(
    () => hasDatabaseBootstrap() ? queryDatabaseSettings() : null,
    [],
    null,
  );
  const theme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!hasDatabaseBootstrap() || !liveSettings) return;
    setThemeMode((current) => current === liveSettings.themeMode ? current : liveSettings.themeMode);
    setBackgroundStyle((current) => current === liveSettings.backgroundStyle ? current : liveSettings.backgroundStyle);
  }, [liveSettings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.dataset.themeMode = themeMode;
    root.dataset.backgroundStyle = backgroundStyle;
    root.style.colorScheme = theme;

    // These two small mirrors are retained only because index.html reads them before React
    // and IndexedDB can start. All application settings are loaded from and persisted to Dexie.
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(BACKGROUND_STYLE_STORAGE_KEY, backgroundStyle);
    } catch {
      // The current session still uses the selected values if the mirror cannot be written.
    }

    if (hasDatabaseBootstrap()) {
      if (!didInitializePersistence.current) didInitializePersistence.current = true;
      else void persistSettings({ themeMode, backgroundStyle }).catch(() => undefined);
    }

    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColorMeta?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
  }, [theme, themeMode, backgroundStyle]);

  return { theme, themeMode, setThemeMode, backgroundStyle, setBackgroundStyle };
}
