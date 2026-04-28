/**
 * Profile page — Premium SaaS Design
 *
 * - Avatar upload (localStorage base64, 4 MB cap, type-validated).
 * - Editable first / last name (live update via PUT /api/users/{id}).
 * - Read-only email + role + account info.
 * - Notification preference toggles.
 * - Navigation visibility preferences.
 * - Link to change password.
 */

import React, { useState, useRef } from 'react';
import {
  Camera, Trash2, Check, AlertCircle, Shield,
  Inbox, Flame, CalendarDays, KeyRound, Loader2, Eye, EyeOff,
  User, Mail, Sparkles,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  useAvatar, writeAvatar, clearAvatar, readFileAsAvatar, initialsFor,
  AVATAR_MAX_BYTES,
} from '../hooks/useAvatar';
import { useHiddenNav, LOCKED_NAV_ITEMS } from '../hooks/useHiddenNav';
import {
  updateUser, getMyPreferences, updateMyPreferences,
} from '../services/auth';
import type { IPreferences } from '../services/auth';

// Sidebar items the user can toggle.
const NAVIGATION_TOGGLES: Array<{ href: string; label: string }> = [
  { href: 'dashboard', label: 'Dashboard' },
  { href: 'coordinator', label: 'Coordinator' },
  { href: 'leads', label: 'All Leads' },
  { href: 'deleted-leads', label: 'Deleted Leads' },
  { href: 'providers', label: 'Providers' },
  { href: 'ai-insights', label: 'AI Insights' },
  { href: 'analytics', label: 'Analytics' },
  { href: 'call-analytics', label: 'Call Analytics' },
  { href: 'settings', label: 'Settings' },
  { href: 'profile', label: 'Profile' },
];

// Role badge styles
const roleBadgeStyle: Record<string, string> = {
  primary_admin: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  administrator: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  coordinator: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  specialist: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
};

const roleDisplayLabels: Record<string, string> = {
  primary_admin: 'Primary Admin',
  administrator: 'Administrator',
  coordinator: 'Coordinator',
  specialist: 'Specialist',
};

function formatRoleLabel(role: string): string {
  return roleDisplayLabels[role] || role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// =============================================================================
// Error parsing
// =============================================================================

function parseApiError(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { detail?: unknown } } };
  const detail = axiosErr?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; message?: string };
    const raw = first?.msg ?? first?.message ?? '';
    return raw.trim() ? `Validation error: ${raw.trim()}` : 'Validation error.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// =============================================================================
// Component
// =============================================================================

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const avatarSrc = useAvatar(user?.id);
  const { hiddenSet, toggle: toggleHidden, resetAll: resetHidden } = useHiddenNav(user?.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Editable name state
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Preferences
  const prefsQuery = useQuery({
    queryKey: ['profile', 'preferences'],
    queryFn: getMyPreferences,
    staleTime: 60_000,
  });
  const [prefsSaving, setPrefsSaving] = useState<keyof IPreferences | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const canAccessSettings = user.role === 'primary_admin' || user.role === 'administrator';
  const navigationItems = NAVIGATION_TOGGLES.filter(
    (item) => item.href !== 'settings' || canAccessSettings,
  );

  const handleAvatarSelect = async (file: File) => {
    setAvatarError(null);
    try {
      const dataUrl = await readFileAsAvatar(file);
      writeAvatar(user.id, dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not load that image.');
    }
  };

  const handleAvatarRemove = () => {
    setAvatarError(null);
    clearAvatar(user.id);
  };

  const handleNameSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setNameStatus({ ok: false, msg: 'First and last name are required.' });
      return;
    }
    setNameSaving(true);
    setNameStatus(null);
    try {
      await updateUser(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setNameStatus({ ok: true, msg: 'Name updated.' });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    } catch (err) {
      setNameStatus({ ok: false, msg: parseApiError(err, 'Could not update your name.') });
    } finally {
      setNameSaving(false);
    }
  };

  const togglePreference = async (key: keyof IPreferences) => {
    if (!prefsQuery.data) return;
    setPrefsError(null);
    setPrefsSaving(key);
    const next = !prefsQuery.data[key];
    try {
      const updated = await updateMyPreferences({ [key]: next } as Partial<IPreferences>);
      queryClient.setQueryData(['profile', 'preferences'], updated);
    } catch (err) {
      setPrefsError(parseApiError(err, 'Could not save preference.'));
    } finally {
      setPrefsSaving(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Sidebar currentPage="profile" onNavigate={(p) => { window.location.hash = p; }} />

      <main className="nr-sidebar-ml p-4 sm:p-6 lg:p-8 flex-1 min-w-0">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <User size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Profile</h1>
                <p className="text-sm text-slate-500">
                  Manage your personal info and notification preferences.
                </p>
              </div>
            </div>
          </header>

          {/* ============================================================= */}
          {/* HERO CARD — Avatar + Identity                                  */}
          {/* ============================================================= */}
          <section className="relative overflow-hidden rounded-2xl mb-6 bg-white ring-1 ring-slate-200 shadow-sm">
            {/* Decorative gradient strip */}
            <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row items-start gap-5 -mt-14">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="relative group">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        className="w-28 h-28 rounded-2xl object-cover ring-4 ring-white shadow-lg"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ring-4 ring-white shadow-lg">
                        <span className="text-3xl font-bold text-white">
                          {initialsFor(user.first_name, user.last_name)}
                        </span>
                      </div>
                    )}
                    {/* Camera overlay */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <Camera size={24} className="text-white drop-shadow" />
                    </button>
                  </div>
                  {/* Online dot */}
                  <span
                    aria-label="Online"
                    className="absolute bottom-1 right-1 block w-5 h-5 rounded-full bg-emerald-500 ring-[3px] ring-white shadow"
                  />
                </div>

                {/* Name + role + avatar actions */}
                <div className="flex-1 min-w-0 pt-16 sm:pt-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-slate-900 truncate">
                      {user.first_name} {user.last_name}
                    </h2>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${roleBadgeStyle[user.role] || 'bg-slate-100 text-slate-600'}`}>
                      <Shield size={10} />
                      {formatRoleLabel(user.role)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    <Mail size={13} /> {user.email}
                  </p>

                  {/* Avatar action buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Camera size={13} /> Upload photo
                    </button>
                    {avatarSrc && (
                      <button
                        onClick={handleAvatarRemove}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarSelect(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-2">
                    PNG, JPEG, WebP, GIF · up to {Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB
                  </p>
                  {avatarError && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} /> {avatarError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================= */}
          {/* EDIT NAME                                                      */}
          {/* ============================================================= */}
          <section className="bg-white ring-1 ring-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Sparkles size={14} className="text-slate-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="w-full px-3 py-2.5 text-sm border border-slate-100 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Contact an administrator to change your email.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleNameSave}
                disabled={nameSaving || (firstName === user.first_name && lastName === user.last_name)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-500/20"
              >
                {nameSaving && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </button>
              {nameStatus && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${nameStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {nameStatus.ok ? <Check size={13} /> : <AlertCircle size={13} />}
                  {nameStatus.msg}
                </span>
              )}
            </div>
          </section>

          {/* ============================================================= */}
          {/* NOTIFICATIONS                                                  */}
          {/* ============================================================= */}
          <section className="bg-white ring-1 ring-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Flame size={14} className="text-slate-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Notifications</h2>
            </div>

            {prefsQuery.isLoading && (
              <p className="text-sm text-slate-500">Loading preferences…</p>
            )}
            {prefsQuery.isError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle size={14} /> Could not load preferences.
              </p>
            )}
            {prefsQuery.data && (
              <div className="space-y-2">
                <PrefRow
                  icon={<Inbox className="w-4 h-4" />}
                  title="New lead alerts"
                  description="Email + in-app toast when a new lead submits the intake form."
                  value={prefsQuery.data.notify_new_lead}
                  loading={prefsSaving === 'notify_new_lead'}
                  onToggle={() => togglePreference('notify_new_lead')}
                />
                <PrefRow
                  icon={<Flame className="w-4 h-4" />}
                  title="Hot lead alerts"
                  description="Higher-priority ping when a lead is scored Hot by the AI."
                  value={prefsQuery.data.notify_hot_lead}
                  loading={prefsSaving === 'notify_hot_lead'}
                  onToggle={() => togglePreference('notify_hot_lead')}
                />
                <PrefRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  title="Daily summary"
                  description="End-of-day digest of new leads, conversions, and outstanding follow-ups."
                  value={prefsQuery.data.notify_daily_summary}
                  loading={prefsSaving === 'notify_daily_summary'}
                  onToggle={() => togglePreference('notify_daily_summary')}
                />
                {prefsError && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
                    <AlertCircle size={12} /> {prefsError}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ============================================================= */}
          {/* NAVIGATION VISIBILITY                                          */}
          {/* ============================================================= */}
          <section className="bg-white ring-1 ring-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Eye size={14} className="text-slate-600" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Navigation</h2>
              </div>
              <button
                onClick={resetHidden}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Show all
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Hide sidebar items you don't use. Dashboard and Profile are always visible.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {navigationItems.map((item) => {
                const locked = LOCKED_NAV_ITEMS.has(item.href);
                const visible = !hiddenSet.has(item.href);
                return (
                  <label
                    key={item.href}
                    className={`flex items-center justify-between p-3 rounded-xl ring-1 transition-colors ${locked
                      ? 'ring-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      : visible
                        ? 'ring-emerald-200 bg-emerald-50/30 cursor-pointer hover:ring-emerald-300'
                        : 'ring-slate-100 bg-white cursor-pointer hover:ring-indigo-200'
                      }`}
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-900">
                      {visible
                        ? <Eye size={14} className="text-emerald-500" />
                        : <EyeOff size={14} className="text-slate-400" />}
                      {item.label}
                      {locked && <span className="text-[10px] text-slate-400 ml-1">(locked)</span>}
                    </span>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      checked={visible}
                      disabled={locked}
                      onChange={() => toggleHidden(item.href)}
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {/* ============================================================= */}
          {/* SECURITY                                                       */}
          {/* ============================================================= */}
          {canAccessSettings && (
            <section className="bg-white ring-1 ring-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <KeyRound size={14} className="text-slate-600" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Security</h2>
              </div>
              <button
                onClick={() => { window.location.hash = 'settings'; }}
                className="w-full inline-flex items-center justify-between px-4 py-3.5 rounded-xl ring-1 ring-slate-200 hover:ring-indigo-300 hover:bg-indigo-50/30 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                    <KeyRound size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Change password</p>
                    <p className="text-xs text-slate-500">
                      Open Settings to rotate your password.
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">Open →</span>
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

// =============================================================================
// Preference row — premium toggle card
// =============================================================================

interface PrefRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  loading: boolean;
  onToggle: () => void;
}

const PrefRow: React.FC<PrefRowProps> = ({ icon, title, description, value, loading, onToggle }) => (
  <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl ring-1 ring-slate-100 hover:ring-slate-200 transition-colors">
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-slate-300'
        } ${loading ? 'opacity-50 cursor-wait' : ''}`}
      aria-label={`Toggle ${title}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  </div>
);

export default ProfilePage;
