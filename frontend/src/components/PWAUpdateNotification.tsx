import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { pwaManager } from '../lib/pwa';

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaManager.onUpdate((event) => {
      if (event.type === 'update-available') {
        setShowUpdate(true);
      }
    });

    return unsubscribe;
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      await pwaManager.skipWaiting();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-top-5">
      <div className="bg-blue-600 border border-blue-500 rounded-lg shadow-2xl p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <RefreshCw className="w-5 h-5 text-white flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white">
                Update Available
              </h3>
              <p className="text-sm text-blue-100 mt-1">
                A new version of Stock Whisperer is ready to install.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-100 hover:text-white transition-colors ml-2"
            aria-label="Dismiss update notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-white text-blue-600 hover:bg-blue-50 disabled:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Update Now'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-blue-100 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
