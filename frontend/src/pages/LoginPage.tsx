/**
 * LoginPage
 *
 * Split layout: left panel (background image + trust badges) and
 * right panel (login form).  Handles both initial login and the
 * forced password-change flow on first access.
 */

import React, { useState, useMemo, FormEvent } from 'react';
import { Shield, Lock, Activity, Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import bgImage from '../assets/TMS_19200x800_1.jpg';

// =============================================================================
// Change-Password Screen (shown after login when must_change_password is true)
// =============================================================================

const ChangePasswordScreen: React.FC = () => {
  const { changePassword, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength validation rules
  const rules = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    passwordsMatch: newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const allRulesMet = rules.minLength && rules.hasUppercase && rules.hasLowercase && rules.hasNumber && rules.hasSpecial && rules.passwordsMatch;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!rules.minLength) { setError('Password must be at least 8 characters'); return; }
    if (!rules.hasUppercase) { setError('Password must contain at least one uppercase letter'); return; }
    if (!rules.hasLowercase) { setError('Password must contain at least one lowercase letter'); return; }
    if (!rules.hasNumber) { setError('Password must contain at least one number'); return; }
    if (!rules.hasSpecial) { setError('Password must contain at least one special character'); return; }
    if (!rules.passwordsMatch) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await changePassword(null, newPassword);
    } catch {
      setError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-1/2 relative flex flex-col text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 50%, #1a2f4a 100%)' }}>
        {/* Background image */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(30,58,95,0.75) 0%, rgba(30,58,95,0.6) 50%, rgba(26,47,74,0.8) 100%)',
        }} />

        {/* Centered content */}
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
          <h2 className="text-3xl font-bold mb-3">Set Your Password</h2>
          <p className="opacity-75 text-base max-w-sm">Choose a strong password to secure your account.</p>
        </div>

        {/* Copyright pinned to bottom */}
        <p className="relative z-10 text-xs opacity-40 text-center py-5">© 2026 TMS Institute of Arizona. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white px-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#eef2f7' }}>
              <Lock size={28} style={{ color: '#1e3a5f' }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Change Your Password</h1>
            <p className="text-gray-500 mt-1">
              Welcome, <span className="font-medium" style={{ color: '#1e3a5f' }}>{user?.first_name}</span>. This is your first login — please set a new password.
            </p>
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
                  className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:border-transparent text-gray-900"
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
                  className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:border-transparent text-gray-900"
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                  onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Strength Indicators */}
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
              onMouseEnter={(e) => { if (!loading && allRulesMet) e.currentTarget.style.background = 'linear-gradient(135deg, #162d4a, #234a6e)'; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f, #2d5986)')}
            >
              <Shield size={18} />
              {loading ? 'Updating…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Login Form
// =============================================================================

const LoginPage: React.FC = () => {
  const { login, mustChangePassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // After a successful login the context updates; if mustChangePassword is
  // true the wrapper shows the change-password screen instead.
  if (mustChangePassword) return <ChangePasswordScreen />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ============================================================
          Left panel — hero image + trust badges
          ============================================================ */}
      <div className="w-1/2 relative flex flex-col text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 50%, #1a2f4a 100%)' }}>

        {/* Background image */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(30,58,95,0.7) 0%, rgba(30,58,95,0.55) 50%, rgba(26,47,74,0.75) 100%)',
        }} />

        {/* Centered content block */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <span className="text-white font-bold text-lg">NR</span>
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold tracking-tight">NeuroReach</p>
              <p className="text-sm opacity-60">AI Platform</p>
            </div>
          </div>

          {/* Main copy */}
          <h1 className="text-4xl font-bold leading-tight mb-4 max-w-md">
            Transform your clinic's<br />
            <span className="opacity-80">patient outreach</span>
          </h1>
          <p className="text-base opacity-75 leading-relaxed max-w-md mb-10">
            Streamline lead capture, automated scoring, and patient engagement — all in one HIPAA-compliant platform built for TMS therapy clinics.
          </p>

          {/* Trust badges */}
          <div className="flex gap-4 w-full max-w-lg">
            {[
              { icon: <Shield size={20} />, label: 'HIPAA Compliant' },
              { icon: <Lock size={20} />, label: '256-bit Encryption' },
              { icon: <Activity size={20} />, label: '99.9% Uptime' },
            ].map((badge) => (
              <div key={badge.label} className="flex-1 flex items-center gap-2.5 bg-white/10 backdrop-blur border border-white/15 rounded-xl px-4 py-3">
                <span className="opacity-80">{badge.icon}</span>
                <span className="text-sm font-medium opacity-90">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright pinned to bottom */}
        <p className="relative z-10 text-xs opacity-40 text-center py-5">© 2026 TMS Institute of Arizona. All rights reserved.</p>
      </div>

      {/* ============================================================
          Right panel — login form
          ============================================================ */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white px-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1">Sign in to access your clinic dashboard</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@clinic.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-transparent text-gray-900 placeholder-gray-400 transition-shadow"
                style={{ boxShadow: 'none' }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: '#1e3a5f' }}>Password</label>
                <a href="#forgot-password" className="text-xs font-medium" style={{ color: '#2d5986' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1e3a5f')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#2d5986')}
                >Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:border-transparent text-gray-900 placeholder-gray-400 transition-shadow"
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                  onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)', boxShadow: 'rgba(30,58,95,0.3) 0px 4px 12px 0px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #162d4a, #234a6e)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f, #2d5986)')}
            >
              <Shield size={18} />
              {loading ? 'Signing in…' : 'Sign In Securely'}
            </button>
          </form>

          {/* Footer link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need access?{' '}
              <a href="#request-invitation" className="font-medium" style={{ color: '#2d5986' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1e3a5f')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#2d5986')}
              >Request an invitation</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
