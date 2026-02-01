/**
 * ResetPasswordPage — Set a new password using a valid reset token.
 */
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { Shield, Lock, Eye, EyeOff, ArrowLeft, Check, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { validateResetToken, resetPassword } from '../services/auth';
import bgImage from '../assets/TMS_19200x800_1.jpg';

const ResetPasswordPage: React.FC = () => {
  // Extract token from hash: #reset-password?token=xxx
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenMessage, setTokenMessage] = useState('');
  const [validating, setValidating] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Extract token on mount
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]token=([^&]+)/);
    if (match) {
      const t = decodeURIComponent(match[1]);
      setToken(t);
      // Validate token
      validateResetToken(t)
        .then((res) => {
          setTokenValid(res.valid);
          setTokenMessage(res.message);
        })
        .catch(() => {
          setTokenValid(false);
          setTokenMessage('Unable to validate reset link. Please try again.');
        })
        .finally(() => setValidating(false));
    } else {
      setTokenValid(false);
      setTokenMessage('No reset token found. Please use the link from your email.');
      setValidating(false);
    }
  }, []);

  // Password rules
  const rules = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/~`]/.test(newPassword),
    passwordsMatch: newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const allRulesMet = rules.minLength && rules.hasUppercase && rules.hasLowercase && rules.hasNumber && rules.hasSpecial && rules.passwordsMatch;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!allRulesMet) return;
    setLoading(true);
    try {
      const res = await resetPassword(token, newPassword);
      setSuccess(true);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Validating your reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-1/2 relative flex flex-col text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 50%, #1a2f4a 100%)' }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(30,58,95,0.75) 0%, rgba(30,58,95,0.6) 50%, rgba(26,47,74,0.8) 100%)',
        }} />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <span className="text-white font-bold text-lg">NR</span>
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold">NeuroReach</p>
              <p className="text-sm opacity-60">AI Platform</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-3">Set New Password</h2>
          <p className="opacity-75 text-base max-w-sm">Choose a strong password to secure your account.</p>
        </div>
        <p className="relative z-10 text-xs opacity-40 text-center py-5">© 2026 TMS Institute of Arizona. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white px-12">
        <div className="w-full max-w-md">
          {/* Token invalid */}
          {!tokenValid && !success && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#fef2f2' }}>
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-500 mb-6">{tokenMessage}</p>
              <a
                href="#forgot-password"
                className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)' }}
              >
                Request a New Link
              </a>
              <div className="mt-6">
                <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: '#2d5986' }}>
                  <ArrowLeft size={16} /> Back to Login
                </a>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#ecfdf5' }}>
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
              <p className="text-gray-500 mb-6">{successMessage}</p>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); window.location.hash = ''; window.location.reload(); }}
                className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)' }}
              >
                <Shield size={18} /> Go to Login
              </a>
            </div>
          )}

          {/* Reset form */}
          {tokenValid && !success && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#eef2f7' }}>
                  <Lock size={28} style={{ color: '#1e3a5f' }} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
                <p className="text-gray-500 mt-1">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none text-gray-900"
                      style={{ boxShadow: 'none' }}
                      onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                      onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none text-gray-900"
                      style={{ boxShadow: 'none' }}
                      onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                      onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {newPassword.length > 0 && (
                  <div className="p-4 rounded-xl border border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Password Requirements</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {([
                        { met: rules.minLength, label: '8+ characters' },
                        { met: rules.hasUppercase, label: 'Uppercase letter' },
                        { met: rules.hasLowercase, label: 'Lowercase letter' },
                        { met: rules.hasNumber, label: 'Number (0-9)' },
                        { met: rules.hasSpecial, label: 'Special character' },
                        { met: rules.passwordsMatch, label: 'Passwords match' },
                      ] as { met: boolean; label: string }[]).map(({ met, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          {met
                            ? <Check size={14} className="text-emerald-500 flex-shrink-0" />
                            : <X size={14} className="text-gray-300 flex-shrink-0" />
                          }
                          <span className={`text-xs ${met ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !allRulesMet}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)', boxShadow: 'rgba(30,58,95,0.3) 0px 4px 12px 0px' }}
                >
                  <Shield size={18} />
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: '#2d5986' }}>
                  <ArrowLeft size={16} /> Back to Login
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
