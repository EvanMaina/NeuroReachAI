/**
 * Settings Dashboard – User Management & Site Configuration
 *
 * Three tabs, all backed by live API calls:
 *   Users            – CRUD on team members (admin-only mutations)
 *   Roles & Perms    – static matrix showing every permission per role
 *   Site Settings    – clinic info, notification prefs, security info
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Users, Shield, Key, UserPlus, Edit2, Trash2,
  Check, X, AlertCircle, Mail, Phone, MapPin, Clock, Lock,
  Save, RefreshCw, CheckCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  listUsers, createUser, updateUser, deactivateUser,
  getMyPreferences, updateMyPreferences,
  getClinicSettings, updateClinicSettings,
} from '../services/auth';
import type {
  IUserProfile, IClinicSettings, IPreferences,
  IUserCreatePayload,
} from '../services/auth';

// =============================================================================
// React Query Keys
// =============================================================================

const SETTINGS_KEYS = {
  users: ['settings', 'users'] as const,
  clinicSettings: ['settings', 'clinic'] as const,
  preferences: ['settings', 'preferences'] as const,
};

// =============================================================================
// Static permission matrix – mirrors backend ROLE_PERMISSIONS exactly
// =============================================================================

const ROLES_MATRIX: { role: string; label: string; description: string; perms: string[] }[] = [
  {
    role: 'primary_admin',
    label: 'Primary Admin',
    description: 'Top-level account owner. Cannot be deactivated or demoted by anyone.',
    perms: [
      'view_leads', 'edit_leads', 'delete_leads',
      'view_analytics', 'manage_users', 'manage_admins', 'view_settings',
      'schedule_callbacks', 'log_contact_attempts',
    ],
  },
  {
    role: 'administrator',
    label: 'Administrator',
    description: 'Full system access including user management and settings',
    perms: [
      'view_leads', 'edit_leads', 'delete_leads',
      'view_analytics', 'manage_users', 'view_settings',
      'schedule_callbacks', 'log_contact_attempts',
    ],
  },
  {
    role: 'coordinator',
    label: 'Coordinator',
    description: 'Manage leads, record outcomes, and schedule appointments',
    perms: [
      'view_leads', 'edit_leads',
      'view_analytics',
      'schedule_callbacks', 'log_contact_attempts',
    ],
  },
  {
    role: 'specialist',
    label: 'Specialist',
    description: 'Read-only access to leads and patient data',
    perms: ['view_leads'],
  },
];

// All unique permissions across all roles (display order)
const ALL_PERMISSIONS = [
  'view_leads',
  'edit_leads',
  'delete_leads',
  'schedule_callbacks',
  'log_contact_attempts',
  'view_analytics',
  'manage_users',
  'manage_admins',
  'view_settings',
];

const PERMISSION_LABELS: Record<string, string> = {
  view_leads:            'View Leads',
  edit_leads:            'Edit Leads',
  delete_leads:          'Delete Leads',
  schedule_callbacks:    'Schedule Callbacks',
  log_contact_attempts:  'Log Contact Attempts',
  view_analytics:        'View Analytics',
  manage_users:          'Manage Users',
  manage_admins:         'Manage Administrators',
  view_settings:         'View Settings',
};

// =============================================================================
// Shared badge helpers
// =============================================================================

const ROLE_STYLES: Record<string, string> = {
  primary_admin: 'bg-red-100 text-red-700 border-red-200',
  administrator: 'bg-purple-100 text-purple-700 border-purple-200',
  coordinator:   'bg-blue-100 text-blue-700 border-blue-200',
  specialist:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  active:   { bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-gray-50 text-gray-600',       dot: 'bg-gray-400' },
  pending:  { bg: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
};

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  primary_admin: 'Primary Admin',
  administrator: 'Administrator',
  coordinator:   'Coordinator',
  specialist:    'Specialist',
};

function RoleBadge({ role }: { role: string }) {
  const label = ROLE_DISPLAY_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${ROLE_STYLES[role] || ROLE_STYLES.specialist}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// =============================================================================
// Add-User Modal
// =============================================================================

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: IUserProfile) => void;
}

function AddUserModal({ isOpen, onClose, onCreated }: AddUserModalProps) {
  const [form, setForm] = useState<IUserCreatePayload>({ email: '', first_name: '', last_name: '', role: 'coordinator' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ email: '', first_name: '', last_name: '', role: 'coordinator' });
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await createUser(form);
      onCreated(user);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">Invite New User</h3>
              <p className="text-blue-100 text-xs">An invitation email will be sent automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
              <input
                required
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Jane"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
              <input
                required
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Smith"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane.smith@clinic.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as IUserCreatePayload['role'] }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="coordinator">Coordinator</option>
              <option value="specialist">Specialist</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Mail size={16} />
              {loading ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Edit-User Modal
// =============================================================================

interface EditUserModalProps {
  user: IUserProfile | null;
  onClose: () => void;
  onSaved: (user: IUserProfile) => void;
}

function EditUserModal({ user, onClose, onSaved }: EditUserModalProps) {
  const [form, setForm] = useState({ first_name: '', last_name: '', role: '', status: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ first_name: user.first_name, last_name: user.last_name, role: user.role, status: user.status });
      setError('');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const updated = await updateUser(user.id, form);
      onSaved(updated);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Edit2 size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">Edit User</h3>
              <p className="text-slate-300 text-xs">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
              <input
                required
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
              <input
                required
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="coordinator">Coordinator</option>
              <option value="specialist">Specialist</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-slate-700 to-slate-900 rounded-lg hover:from-slate-800 hover:to-slate-950 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Confirm-Deactivate Modal
// =============================================================================

function DeactivateConfirmModal({
  user,
  onConfirm,
  onCancel,
  isLoading,
}: {
  user: IUserProfile | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 size={22} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Deactivate User</h3>
            <p className="text-sm text-gray-500">This will revoke {user.first_name}'s access immediately.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} disabled={isLoading} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isLoading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Users Tab
// =============================================================================

function UsersTab() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch]     = useState('');

  // Modal state
  const [addOpen, setAddOpen]               = useState(false);
  const [editUser_state, setEditUser]       = useState<IUserProfile | null>(null);
  const [deactivateUser_state, setDeactivateUser] = useState<IUserProfile | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [actionError, setActionError]       = useState('');

  // React Query: persistent user list with caching
  const { data: usersData, isLoading: loading, error: queryError, refetch: fetchUsers } = useQuery({
    queryKey: SETTINGS_KEYS.users,
    queryFn: async () => {
      const res = await listUsers();
      return res.items;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 3,
  });

  const users = usersData || [];
  const error = queryError ? ((queryError as any)?.response?.data?.detail || 'Failed to load users') : actionError;

  const handleDeactivate = async () => {
    if (!deactivateUser_state) return;
    setDeactivateLoading(true);
    try {
      await deactivateUser(deactivateUser_state.id);
      // Optimistic update in cache
      queryClient.setQueryData<IUserProfile[]>(SETTINGS_KEYS.users, (prev) =>
        prev?.map(u => u.id === deactivateUser_state.id ? { ...u, status: 'inactive' as const } : u) || []
      );
      setDeactivateUser(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || 'Failed to deactivate');
      setDeactivateUser(null);
    } finally {
      setDeactivateLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.email.includes(q) || u.first_name.toLowerCase().includes(q) || u.last_name.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Sub-header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} in your organization</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 w-56 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-600/20">
              <UserPlus size={16} />
              Add User
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchUsers()} className="text-red-600 hover:underline text-xs flex items-center gap-1"><RefreshCw size={12} /> Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
                          {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{u.first_name} {u.last_name}{isSelf && <span className="ml-1.5 text-xs text-blue-600 font-normal">(you)</span>}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4"><RoleBadge role={u.role} /></td>
                    <td className="py-4 px-4"><StatusBadge status={u.status} /></td>
                    <td className="py-4 px-4 text-sm text-gray-500">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditUser(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        {!isSelf && u.role !== 'primary_admin' && (
                          <button onClick={() => setDeactivateUser(u)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-gray-500">No users match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u: IUserProfile) => { queryClient.setQueryData<IUserProfile[]>(SETTINGS_KEYS.users, (prev) => [...(prev || []), u]); setAddOpen(false); }}
      />
      <EditUserModal
        user={editUser_state}
        onClose={() => setEditUser(null)}
        onSaved={(u: IUserProfile) => { queryClient.setQueryData<IUserProfile[]>(SETTINGS_KEYS.users, (prev) => prev?.map(old => old.id === u.id ? u : old) || []); setEditUser(null); }}
      />
      <DeactivateConfirmModal
        user={deactivateUser_state}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateUser(null)}
        isLoading={deactivateLoading}
      />
    </>
  );
}

// =============================================================================
// Roles & Permissions Tab
// =============================================================================

function RolesTab() {
  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES_MATRIX.map(r => (
          <div key={r.role} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                r.role === 'primary_admin' ? 'bg-gradient-to-br from-red-500 to-rose-600'      :
                r.role === 'administrator' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                r.role === 'coordinator'   ? 'bg-gradient-to-br from-blue-500 to-cyan-600'     :
                                            'bg-gradient-to-br from-emerald-500 to-teal-600'
              }`}>
                <Shield size={20} className="text-white" />
              </div>
              <RoleBadge role={r.role} />
            </div>
            <h3 className="font-semibold text-gray-900">{r.label}</h3>
            <p className="text-sm text-gray-500 mt-0.5 mb-3">{r.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Key size={12} />{r.perms.length} permissions</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full permission matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Permission Matrix</h2>
          <p className="text-sm text-gray-500">Exact permissions enforced by the backend for each role</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permission</th>
                {ROLES_MATRIX.map(r => (
                  <th key={r.role} className="text-center py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map(perm => (
                <tr key={perm} className="border-b border-gray-50">
                  <td className="py-3 px-6 text-sm font-medium text-gray-700">{PERMISSION_LABELS[perm]}</td>
                  {ROLES_MATRIX.map(r => (
                    <td key={r.role} className="text-center py-3 px-6">
                      {r.perms.includes(perm) ? (
                        <div className="inline-flex items-center justify-center w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg">
                          <Check size={16} />
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 text-gray-400 rounded-lg">
                          <X size={16} />
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-900">Role-Based Access Control (RBAC)</h4>
            <p className="text-sm text-amber-700 mt-1">
              Permissions are enforced on every API endpoint and at the UI layer. Only administrators can change user roles. Contact support for custom role configurations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Site Settings Tab
// =============================================================================

function SiteSettingsTab() {
  const { user } = useAuth();

  // Clinic info
  const [clinic, setClinic]           = useState<IClinicSettings>({ clinic_name: '', clinic_address: '', clinic_phone: '', clinic_email: '' });
  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicSaving, setClinicSaving]   = useState(false);
  const [clinicError, setClinicError]     = useState('');
  const [clinicSuccess, setClinicSuccess] = useState(false);

  // Notification preferences
  const [prefs, setPrefs]               = useState<IPreferences>({ notify_new_lead: true, notify_hot_lead: true, notify_daily_summary: true });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving]   = useState(false);
  const [prefsError, setPrefsError]     = useState('');

  // Load on mount
  useEffect(() => {
    getClinicSettings()
      .then(d => setClinic(d))
      .catch(err => setClinicError(err?.response?.data?.detail || 'Failed to load clinic settings'))
      .finally(() => setClinicLoading(false));

    getMyPreferences()
      .then(d => setPrefs(d))
      .catch(err => setPrefsError(err?.response?.data?.detail || 'Failed to load preferences'))
      .finally(() => setPrefsLoading(false));
  }, []);

  const handleClinicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clinicSaving) return; // double-click prevention
    setClinicSaving(true);
    setClinicError('');
    setClinicSuccess(false);
    try {
      const updated = await updateClinicSettings(clinic);
      setClinic(updated);
      setClinicSuccess(true);
      setTimeout(() => setClinicSuccess(false), 3000);
    } catch (err: any) {
      setClinicError(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setClinicSaving(false);
    }
  };

  const handlePrefToggle = async (key: keyof IPreferences) => {
    setPrefsSaving(true);
    setPrefsError('');
    const next = { ...prefs, [key]: !prefs[key] };
    try {
      const updated = await updateMyPreferences({ [key]: next[key] });
      setPrefs(updated);
    } catch (err: any) {
      setPrefsError(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clinic Information */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Clinic Information</h2>
          <p className="text-sm text-gray-500">Details shown in patient communications and reports</p>
        </div>

        {clinicLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <form onSubmit={handleClinicSave} className="p-6 space-y-4">
            {clinicError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{clinicError}</div>}
            {clinicSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
                <CheckCircle size={16} /> Clinic settings saved successfully!
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin size={12} /> Clinic Name
              </label>
              <input
                value={clinic.clinic_name}
                onChange={e => setClinic(c => ({ ...c, clinic_name: e.target.value }))}
                placeholder="TMS Institute of Arizona"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin size={12} /> Address
              </label>
              <input
                value={clinic.clinic_address}
                onChange={e => setClinic(c => ({ ...c, clinic_address: e.target.value }))}
                placeholder="123 Medical Drive, Suite 400"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone size={12} /> Phone
                </label>
                <input
                  value={clinic.clinic_phone}
                  onChange={e => setClinic(c => ({ ...c, clinic_phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} /> Email
                </label>
                <input
                  type="email"
                  value={clinic.clinic_email}
                  onChange={e => setClinic(c => ({ ...c, clinic_email: e.target.value }))}
                  placeholder="info@clinic.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={clinicSaving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
              >
                <Save size={15} />
                {clinicSaving ? 'Saving…' : 'Save Clinic Info'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded-full">Coming Soon</span>
          </div>
          <p className="text-sm text-gray-500">Toggle preferences are saved but email delivery is not yet active</p>
        </div>

        {prefsLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="p-6 space-y-4">
            {prefsError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{prefsError}</div>}

            {([
              { key: 'notify_new_lead' as const,       label: 'New Lead Notification',     desc: 'Notified when a new lead is submitted' },
              { key: 'notify_hot_lead' as const,       label: 'Hot Lead Alert',            desc: 'Notified when a lead is scored as high priority' },
              { key: 'notify_daily_summary' as const,  label: 'Daily Summary Email',       desc: 'Receive a daily digest of lead activity' },
            ] as const).map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrefToggle(item.key)}
                  disabled={prefsSaving}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${prefs[item.key] ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${prefs[item.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Info */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <p className="text-sm text-gray-500">Account and session information</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Lock size={22} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Logged In As</p>
              <p className="text-xs text-gray-500">{user?.email || '—'}</p>
            </div>
            <RoleBadge role={user?.role || ''} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Login</p>
              </div>
              <p className="text-sm text-gray-700">
                {user?.last_login ? new Date(user.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Created</p>
              </div>
              <p className="text-sm text-gray-700">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Sessions are stored in the browser tab and expire when the tab is closed. Password resets require administrator assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export const SettingsDashboard: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('settings');
  const [activeTab, setActiveTab]     = useState<'users' | 'roles' | 'site'>('users');

  const TABS = [
    { id: 'users' as const, label: 'Users',              icon: <Users size={18} /> },
    { id: 'roles' as const, label: 'Roles & Permissions', icon: <Shield size={18} /> },
    { id: 'site' as const,  label: 'Site Settings',      icon: <Key size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50">
      <Sidebar currentPage={currentPage} onNavigate={page => setCurrentPage(page)} />

      <main className="ml-60 p-8">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-xl shadow-gray-900/20">
            <Settings size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Settings</h1>
            <p className="text-gray-500">Manage users, roles, and clinic configuration</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-white rounded-2xl border border-gray-100 mb-6">
          <div className="flex border-b border-gray-100">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'site'  && <SiteSettingsTab />}
      </main>
    </div>
  );
};

export default SettingsDashboard;
