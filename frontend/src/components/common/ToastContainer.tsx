/**
 * Toast Notification System
 * 
 * App-shell level toast notifications for new leads, errors, and success messages.
 * Uses CustomEvent('neuroreach:toast') for cross-component communication.
 * 
 * Usage from anywhere:
 *   window.dispatchEvent(new CustomEvent('neuroreach:toast', {
 *     detail: { type: 'success', title: 'Lead Updated', message: 'Status changed to contacted' }
 *   }));
 * 
 * @module components/common/ToastContainer
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Flame } from 'lucide-react';
import { playNotificationChime } from '../../utils/notificationSound';

// =============================================================================
// Types
// =============================================================================

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'new-lead';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

interface ToastEventDetail {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// =============================================================================
// Toast Style Config
// =============================================================================

const TOAST_STYLES: Record<ToastType, {
  bg: string;
  border: string;
  icon: React.ReactNode;
  iconBg: string;
}> = {
  success: {
    bg: 'bg-white',
    border: 'border-green-200',
    icon: <CheckCircle size={18} className="text-green-600" />,
    iconBg: 'bg-green-50',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    icon: <AlertTriangle size={18} className="text-red-600" />,
    iconBg: 'bg-red-50',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200',
    icon: <AlertTriangle size={18} className="text-amber-600" />,
    iconBg: 'bg-amber-50',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    icon: <Info size={18} className="text-blue-600" />,
    iconBg: 'bg-blue-50',
  },
  'new-lead': {
    bg: 'bg-white',
    border: 'border-orange-200',
    icon: <Flame size={18} className="text-orange-600" />,
    iconBg: 'bg-orange-50',
  },
};

// =============================================================================
// Component
// =============================================================================

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Add a toast
  const addToast = useCallback((detail: ToastEventDetail) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = detail.duration ?? (detail.type === 'error' ? 8000 : 5000);

    const newToast: Toast = {
      id,
      type: detail.type,
      title: detail.title,
      message: detail.message,
      duration,
      createdAt: Date.now(),
    };

    setToasts(prev => [...prev.slice(-4), newToast]); // Keep max 5

    // Play professional chime for new leads
    if (detail.type === 'new-lead') {
      playNotificationChime();
    }

    // Auto-dismiss
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  // Listen for custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastEventDetail>).detail;
      if (detail && detail.title) {
        addToast(detail);
      }
    };

    window.addEventListener('neuroreach:toast', handler);
    return () => window.removeEventListener('neuroreach:toast', handler);
  }, [addToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-start gap-3 px-4 py-3
              ${style.bg} border ${style.border} rounded-xl shadow-lg
              animate-in slide-in-from-right duration-300
              transition-all
            `}
            role="alert"
            style={{
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            {/* Icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center mt-0.5`}>
              {style.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.message}</p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

// =============================================================================
// Helper: dispatch toast from anywhere
// =============================================================================

export function showToast(type: ToastType, title: string, message?: string, duration?: number) {
  window.dispatchEvent(new CustomEvent('neuroreach:toast', {
    detail: { type, title, message, duration },
  }));
}

export default ToastContainer;
