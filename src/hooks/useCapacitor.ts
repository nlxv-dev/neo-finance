import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

interface UseCapacitorOptions {
  theme: 'dark' | 'light';
  activeTab: string;
  onNavigateHome: () => void;
  hasOpenModal: boolean;
  onCloseTopModal: () => void;
}

/**
 * Manages native Android lifecycle, hardware back button navigation,
 * and status bar styling when running inside Capacitor.
 */
export function useCapacitor({
  theme,
  activeTab,
  onNavigateHome,
  hasOpenModal,
  onCloseTopModal,
}: UseCapacitorOptions): void {
  // Sync native status bar with theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const configureStatusBar = async () => {
      try {
        if (theme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#050508' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        }
      } catch {
        // Status bar plugin might not be supported on some webview configurations
      }
    };

    configureStatusBar();
  }, [theme]);

  // Handle hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1. If any sheet or modal is open, dismiss it
      if (hasOpenModal) {
        onCloseTopModal();
        return;
      }

      // 2. If inside a non-home tab (wallet, stats, chart), return to home tab
      if (activeTab !== 'home') {
        onNavigateHome();
        return;
      }

      // 3. If on home with browser history, go back; otherwise exit app
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backButtonListener.then((handler) => handler.remove());
    };
  }, [hasOpenModal, onCloseTopModal, activeTab, onNavigateHome]);
}
