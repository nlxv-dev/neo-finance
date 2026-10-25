import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type BackgroundStyle = 'gradient' | 'solid';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fintrack-theme';
const BACKGROUND_STYLE_STORAGE_KEY = 'fintrack-background-style';

function isThemeMode(value: string | undefined | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isBackgroundStyle(value: string | undefined | null): value is BackgroundStyle {
  return value === 'gradient' || value === 'solid';
}

function readInitialBackgroundStyle(): BackgroundStyle {
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
  const theme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  // Track OS appearance only while calculating the system option; this also reacts to OS changes.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Keep the document theme, native controls, browser chrome, and persisted choice in sync.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.dataset.themeMode = themeMode;
    root.style.colorScheme = theme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // The UI still works when persistent storage is unavailable.
    }

    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColorMeta?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
  }, [theme, themeMode]);

  // Background appearance is an independent preference; changing it never changes the light/dark theme.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.backgroundStyle = backgroundStyle;

    try {
      window.localStorage.setItem(BACKGROUND_STYLE_STORAGE_KEY, backgroundStyle);
    } catch {
      // The preference still applies for the current session when storage is unavailable.
    }
  }, [backgroundStyle]);

  return { theme, themeMode, setThemeMode, backgroundStyle, setBackgroundStyle };
}
