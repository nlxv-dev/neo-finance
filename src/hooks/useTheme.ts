import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fintrack-theme';

function isThemeMode(value: string | undefined | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
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

  return { theme, themeMode, setThemeMode };
}
