import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { pwaManager } from '../lib/pwa';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (pwaManager.isInstalled()) {
      return;
    }

    const timer = setTimeout(() => {
      if (pwaManager.canInstall() && !localStorage.getItem('pwa-prompt-dismissed')) {
        setShowPrompt(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);

    try {
      const success = await pwaManager.install();

      if (success) {
        setShowPrompt(false);
        localStorage.setItem('pwa-installed', 'true');
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">
                Install Stock Whisperer
              </h3>
              <p className="text-sm text-slate-400">
                Add to home screen
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-100 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 mb-4 text-sm">
          Install Stock Whisperer for faster access, offline support, and a native app experience.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-slate-400 hover:text-slate-100 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
