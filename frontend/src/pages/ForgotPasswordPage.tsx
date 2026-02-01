/**
 * ForgotPasswordPage — Request a password reset link.
 */
import React, { useState, FormEvent } from 'react';
import { Mail, ArrowLeft, Shield, Lock, Activity, CheckCircle } from 'lucide-react';
import { forgotPassword } from '../services/auth';
import bgImage from '../assets/TMS_19200x800_1.jpg';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <span className="text-white font-bold text-lg">NR</span>
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold tracking-tight">NeuroReach</p>
              <p className="text-sm opacity-60">AI Platform</p>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4 max-w-md">
            Password Reset
          </h1>
          <p className="text-base opacity-75 leading-relaxed max-w-md mb-10">
            We'll send you a secure link to reset your password. The link expires in 1 hour for your security.
          </p>
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
        <p className="relative z-10 text-xs opacity-40 text-center py-5">© 2026 TMS Institute of Arizona. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white px-12">
        <div className="w-full max-w-md">
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#eef2f7' }}>
                  <Mail size={28} style={{ color: '#1e3a5f' }} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Reset Your Password</h2>
                <p className="text-gray-500 mt-2">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@clinic.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none text-gray-900 placeholder-gray-400"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)', boxShadow: 'rgba(30,58,95,0.3) 0px 4px 12px 0px' }}
                >
                  <Mail size={18} />
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#ecfdf5' }}>
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
              <p className="text-gray-500 mb-6">{message}</p>
              <div className="p-4 rounded-xl border border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                <p className="text-sm text-gray-500">
                  Didn't receive an email? Check your spam folder or wait a few minutes and try again.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: '#2d5986' }}
            >
              <ArrowLeft size={16} />
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
