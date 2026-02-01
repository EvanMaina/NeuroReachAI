/**
 * RequestInvitationPage — Request access to the TMS NeuroReach dashboard.
 */
import React, { useState, FormEvent } from 'react';
import { UserPlus, ArrowLeft, Shield, Lock, Activity, CheckCircle } from 'lucide-react';
import { requestAccess } from '../services/auth';
import bgImage from '../assets/TMS_19200x800_1.jpg';

const RequestInvitationPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await requestAccess({ full_name: fullName, email, reason });
      setMessage(res.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = fullName.trim().length >= 2 && email.trim().length > 0 && reason.trim().length >= 5;

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
            Request Access
          </h1>
          <p className="text-base opacity-75 leading-relaxed max-w-md mb-10">
            Submit your information and an administrator will review your request and send you an invitation.
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
                  <UserPlus size={28} style={{ color: '#1e3a5f' }} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Request an Invitation</h2>
                <p className="text-gray-500 mt-2">
                  Fill out the form below and an administrator will review your request.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="full-name" className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Full Name</label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                    minLength={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none text-gray-900 placeholder-gray-400"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>

                <div>
                  <label htmlFor="request-email" className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Email Address</label>
                  <input
                    id="request-email"
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

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium mb-1.5" style={{ color: '#1e3a5f' }}>Role / Reason for Access</label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Care coordinator needing access to manage patient leads"
                    required
                    minLength={5}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none text-gray-900 placeholder-gray-400 resize-none"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px #1e3a5f'; e.target.style.borderColor = '#1e3a5f'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5986)', boxShadow: 'rgba(30,58,95,0.3) 0px 4px 12px 0px' }}
                >
                  <UserPlus size={18} />
                  {loading ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#ecfdf5' }}>
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h2>
              <p className="text-gray-500 mb-6">{message}</p>
              <div className="p-4 rounded-xl border border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                <p className="text-sm text-gray-500">
                  An administrator will review your request and send you an invitation email with login credentials.
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

export default RequestInvitationPage;
