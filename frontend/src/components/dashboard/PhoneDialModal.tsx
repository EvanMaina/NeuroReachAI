/**
 * Phone Dial Modal
 * 
 * Professional styled modal replacing native prompt() for 3CX click-to-call.
 * Formats phone numbers and triggers tel: URI for 3CX Chrome extension.
 * 
 * @module components/dashboard/PhoneDialModal
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PhoneCall, X, Phone } from 'lucide-react';

interface PhoneDialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
}

export const PhoneDialModal: React.FC<PhoneDialModalProps> = ({
  isOpen,
  onClose,
  onCall,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPhoneNumber('');
    // Small delay to ensure modal is rendered before focusing
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phoneNumber.trim();
    if (trimmed) {
      onCall(trimmed);
      onClose();
    }
  }, [phoneNumber, onCall, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 flex items-center justify-between border-b border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <PhoneCall size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Quick Call via 3CX</h3>
              <p className="text-xs text-gray-500">Enter a phone number to dial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="relative">
            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-400"
              autoComplete="tel"
            />
          </div>

          <p className="mt-2 text-xs text-gray-400">
            3CX Chrome extension will handle the call automatically.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!phoneNumber.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PhoneCall size={16} />
              Call Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhoneDialModal;
