/**
 * Connection Status Banner
 * 
 * Shows a banner at the top when:
 * - Internet connection is lost
 * - Connection is restored
 * - API is unreachable
 * 
 * Features:
 * - Auto-dismisses after reconnection
 * - Retry button for manual recovery
 * - Non-intrusive design
 */

import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface ConnectionStatusBannerProps {
  isOnline: boolean;
  isReconnecting?: boolean;
  onRetry?: () => void;
}

export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({ 
  isOnline,
  isReconnecting = false,
  onRetry 
}) => {
  // Don't show anything if online
  if (isOnline && !isReconnecting) return null;

  return (
    <div 
      className={`
        fixed top-0 left-0 right-0 z-50 
        ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}
        text-white px-4 py-3 shadow-lg
        animate-in slide-in-from-top duration-300
      `}
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <>
              <Wifi size={20} />
              <span className="font-medium">Connection restored</span>
              <span className="text-sm opacity-90">— Syncing data...</span>
            </>
          ) : (
            <>
              <WifiOff size={20} />
              <span className="font-medium">Connection lost</span>
              <span className="text-sm opacity-90">— You're offline. Changes will sync when reconnected.</span>
            </>
          )}
        </div>
        
        {!isOnline && onRetry && (
          <button
            onClick={onRetry}
            disabled={isReconnecting}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} className={isReconnecting ? 'animate-spin' : ''} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatusBanner;
