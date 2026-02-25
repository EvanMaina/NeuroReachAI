/**
 * ProviderEmailDialog
 *
 * Modal dialog to compose and send a direct email to a referring provider.
 * Uses the platform SMTP email service via POST /api/providers/{id}/email.
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { Provider } from '../../types/provider';

interface ProviderEmailDialogProps {
  provider: Provider | null;
  isOpen: boolean;
  onClose: () => void;
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export const ProviderEmailDialog: React.FC<ProviderEmailDialogProps> = ({
  provider,
  isOpen,
  onClose,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form each time the dialog opens for a (potentially new) provider
  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setMessage('');
      setSendStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, provider?.id]);

  if (!isOpen || !provider) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSendStatus('sending');
    setErrorMessage('');

    try {
      // Import lazily to avoid circular deps and keep the bundle lean
      const { sendProviderEmail } = await import('../../services/providers');
      await sendProviderEmail(provider.id, subject.trim(), message.trim());
      setSendStatus('success');
      // Auto-close after showing success state
      setTimeout(() => onClose(), 1600);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(detail || 'Failed to send email. Please try again.');
      setSendStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Email Provider</h2>
              <p className="text-xs text-gray-500 truncate" style={{ maxWidth: '280px' }}>
                {provider.name}
                {provider.email ? ` · ${provider.email}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Success State ── */}
        {sendStatus === 'success' ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">Email Sent!</p>
              <p className="text-sm text-gray-500 mt-1">
                Your message was delivered to <span className="font-medium">{provider.name}</span>.
              </p>
            </div>
          </div>
        ) : (
          /* ── Compose Form ── */
          <form onSubmit={handleSend} className="p-6 space-y-4">
            {/* Error banner */}
            {sendStatus === 'error' && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{errorMessage}</p>
              </div>
            )}

            {/* No email warning */}
            {!provider.email && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  This provider has no email address on file. Please add one before sending.
                </p>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Patient Referral Update"
                disabled={!provider.email || sendStatus === 'sending'}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here…"
                disabled={!provider.email || sendStatus === 'sending'}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={sendStatus === 'sending'}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100
                           rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  sendStatus === 'sending' ||
                  !provider.email ||
                  !subject.trim() ||
                  !message.trim()
                }
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white
                           bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendStatus === 'sending' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProviderEmailDialog;
