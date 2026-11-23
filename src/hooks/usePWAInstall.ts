import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global singleton state so beforeinstallprompt is captured immediately at module load
// and never lost across component mounts/unmounts (e.g. AuthGate -> App).
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });

  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  standaloneQuery.addEventListener?.('change', (ev) => {
    if (ev.matches) {
      globalIsInstalled = true;
      globalDeferredPrompt = null;
      notifyListeners();
    }
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;
    const promptEvent = globalDeferredPrompt;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      globalIsInstalled = true;
      globalDeferredPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(globalDeferredPrompt),
    isInstalled: globalIsInstalled,
    isIOS,
    install,
  };
}
