export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAUpdateEvent {
  type: 'update-available' | 'update-installed' | 'update-failed';
  registration?: ServiceWorkerRegistration;
  error?: Error;
}

export type PWAUpdateCallback = (event: PWAUpdateEvent) => void;

export class PWAManager {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private updateCallbacks: Set<PWAUpdateCallback> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as BeforeInstallPromptEvent;
      console.log('[PWA] Install prompt available');
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      this.installPrompt = null;
    });

    window.addEventListener('online', () => {
      console.log('[PWA] Online');
      this.notifyUpdate({ type: 'update-available' });
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] Offline');
    });
  }

  async register(): Promise<ServiceWorkerRegistration | null> {
    // Skip service worker entirely in dev; also clean up any previous registrations.
    if (import.meta.env.DEV) {
      await this.unregisterAll();
      console.info('[PWA] Skipping service worker registration in dev');
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service workers not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service worker registered:', this.registration.scope);

      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (!newWorker) return;

        console.log('[PWA] Update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available');
            this.notifyUpdate({
              type: 'update-available',
              registration: this.registration!
            });
          }
        });
      });

      await this.checkForUpdates();

      setInterval(() => this.checkForUpdates(), 60000);

      return this.registration;
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
      this.notifyUpdate({
        type: 'update-failed',
        error: error as Error
      });
      return null;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const success = await this.registration.unregister();
      if (success) {
        console.log('[PWA] Service worker unregistered');
        this.registration = null;
      }
      return success;
    } catch (error) {
      console.error('[PWA] Service worker unregistration failed:', error);
      return false;
    }
  }

  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('[PWA] Checked for updates');
    } catch (error) {
      console.error('[PWA] Update check failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    await new Promise<void>((resolve) => {
      const listener = () => {
        if (this.registration?.active?.state === 'activated') {
          navigator.serviceWorker.removeEventListener('controllerchange', listener);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', listener);
    });

    window.location.reload();
  }

  async clearCache(): Promise<void> {
    if (!this.registration?.active) return;

    this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
    console.log('[PWA] Cache cleared');
  }

  async getVersion(): Promise<string | null> {
    if (!this.registration?.active) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };

      this.registration!.active!.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );

      setTimeout(() => resolve(null), 1000);
    });
  }

  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  async install(): Promise<boolean> {
    if (!this.installPrompt) {
      console.warn('[PWA] Install prompt not available');
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choiceResult = await this.installPrompt.userChoice;

      console.log('[PWA] Install choice:', choiceResult.outcome);

      if (choiceResult.outcome === 'accepted') {
        this.installPrompt = null;
        return true;
      }

      return false;
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    }
  }

  isInstalled(): boolean {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    if ((window.navigator as any).standalone === true) {
      return true;
    }

    return false;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  onUpdate(callback: PWAUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  private notifyUpdate(event: PWAUpdateEvent): void {
    this.updateCallbacks.forEach(callback => callback(event));
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[PWA] Notification permission:', permission);
    return permission;
  }

  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.registration) {
      console.warn('[PWA] Service worker not registered');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[PWA] Notification permission not granted');
      return;
    }

    await this.registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options
    });
  }

  async enableBackgroundSync(tag: string): Promise<void> {
    if (!this.registration) {
      console.warn('[PWA] Service worker not registered');
      return;
    }

    if (!('sync' in this.registration)) {
      console.warn('[PWA] Background sync not supported');
      return;
    }

    try {
      await (this.registration as any).sync.register(tag);
      console.log('[PWA] Background sync registered:', tag);
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }

  getConnectionInfo(): {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  } {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    };
  }

  // Dev helper: remove any registered SWs (used when skipping SW in dev)
  private async unregisterAll(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
}

export const pwaManager = new PWAManager();
