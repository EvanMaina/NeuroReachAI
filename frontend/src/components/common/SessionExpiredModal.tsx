/**
 * Session Expired Modal
 * 
 * Full-screen overlay that appears when the user's session expires.
 * Cannot be dismissed - forces user to log in again.
 * 
 * Features:
 * - Non-dismissible (no close button, no click-outside)
 * - Stores current URL to redirect back after login
 * - Clear messaging about data safety
 * - Professional, calming design
 */

import React, { useEffect } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLoginClick: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ 
  isOpen, 
  onLoginClick 
}) => {
  // Store current URL when modal opens so we can redirect back after login
  useEffect(() => {
    if (isOpen) {
      const currentPath = window.location.hash;
      if (currentPath) {
        sessionStorage.setItem('nr_redirect_after_login', currentPath);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen backdrop - not dismissible */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in duration-300">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
          
          {/* Title */}
          <h2 
            id="session-expired-title" 
            className="text-2xl font-bold text-gray-900 text-center mb-3"
          >
            Your session has expired
          </h2>
          
          {/* Message */}
          <div className="space-y-3 mb-8">
            <p className="text-gray-600 text-center">
              For your security, you've been signed out after a period of inactivity.
            </p>
            <p className="text-sm text-emerald-600 text-center font-medium">
              ✓ Your data is safe — all information is securely stored
            </p>
            <p className="text-sm text-gray-500 text-center">
              You'll return to where you left off after logging in.
            </p>
          </div>
          
          {/* Login Button */}
          <button
            onClick={onLoginClick}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20"
          >
            <LogIn size={20} />
            Log In Again
          </button>
          
          {/* Help text */}
          <p className="text-xs text-gray-400 text-center mt-6">
            If you continue to experience issues, please contact support
          </p>
        </div>
      </div>
    </>
  );
};

export default SessionExpiredModal;
