/**
 * Referring Providers Dashboard
 * 
 * Displays referring healthcare providers with KPIs, searchable table,
 * and management capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  PhoneCall,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Archive,
  ExternalLink,
  X,
  Loader2,
  User,
} from 'lucide-react';
import { listLeads, updateContactOutcome } from '../services/leads';
import type { ILeadListItem, ContactOutcome } from '../types/lead';
import { Sidebar } from '../components/dashboard/Sidebar';
import {
  getProviders,
  getProviderStats,
  createProvider,
  updateProvider,
  archiveProvider,
  providerKeys,
} from '../services/providers';
import {
  Provider,
  ProviderCreateRequest,
  ProviderUpdateRequest,
  ProviderFilters,
  ProviderSpecialty,
  ProviderStatus,
  SPECIALTY_LABELS,
  getSpecialtyLabel,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../types/provider';

// =============================================================================
// KPI Card Component
// =============================================================================

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, trend, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        {trend && (
          <p className={`mt-2 text-sm flex items-center gap-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp size={14} className={trend.isPositive ? '' : 'rotate-180'} />
            {trend.isPositive ? '+' : ''}{trend.value}% from last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

// =============================================================================
// Add/Edit Provider Modal
// =============================================================================

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate email format - must have valid structure with domain
 */
function validateEmail(email: string): { valid: boolean; message: string } {
  if (!email || !email.trim()) {
    return { valid: true, message: '' }; // Email is optional
  }
  
  // Comprehensive email regex - requires valid format with domain
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(email.trim())) {
    return { valid: false, message: 'Please enter a valid email address (e.g., doctor@clinic.com)' };
  }
  
  return { valid: true, message: '' };
}

/**
 * Validate phone number - E.164 international format
 * Format: +[country code][number] (e.g., +254785778988, +14155552671)
 */
function validatePhone(phone: string): { valid: boolean; message: string } {
  if (!phone || !phone.trim()) {
    return { valid: true, message: '' }; // Phone is optional
  }
  
  const trimmedPhone = phone.trim();
  
  // E.164 format: starts with +, followed by 1-3 digit country code, then 6-14 digits
  // Total length: 8-15 characters (including +)
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  
  if (!e164Regex.test(trimmedPhone)) {
    return { 
      valid: false, 
      message: 'Please enter phone in E.164 format (e.g., +254785778988 or +14155552671)' 
    };
  }
  
  return { valid: true, message: '' };
}

interface ProviderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: Provider | null;
  onSave: (data: ProviderCreateRequest | ProviderUpdateRequest) => void;
  isLoading: boolean;
}

const ProviderFormModal: React.FC<ProviderFormModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSave,
  isLoading,
}) => {
  const [formData, setFormData] = useState<ProviderCreateRequest>({
    name: '',
    email: '',
    phone: '',
    practice_name: '',
    specialty: 'other',
    status: 'pending',
    notes: '',
  });
  
  // Validation error states
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        email: provider.email || '',
        phone: provider.phone || '',
        practice_name: provider.practice_name || '',
        specialty: provider.specialty,
        status: provider.status,
        notes: provider.notes || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        practice_name: '',
        specialty: 'other',
        status: 'pending',
        notes: '',
      });
    }
    // Clear errors when modal opens/closes
    setEmailError('');
    setPhoneError('');
  }, [provider, isOpen]);

  if (!isOpen) return null;

  // Validate email on blur
  const handleEmailBlur = () => {
    const result = validateEmail(formData.email || '');
    setEmailError(result.message);
  };

  // Validate phone on blur
  const handlePhoneBlur = () => {
    const result = validatePhone(formData.phone || '');
    setPhoneError(result.message);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate before submission
    const emailValidation = validateEmail(formData.email || '');
    const phoneValidation = validatePhone(formData.phone || '');
    
    setEmailError(emailValidation.message);
    setPhoneError(phoneValidation.message);
    
    // Don't submit if validation fails
    if (!emailValidation.valid || !phoneValidation.valid) {
      return;
    }
    
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {provider ? 'Edit Provider' : 'Add New Provider'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Dr. Jane Smith"
            />
          </div>

          {/* Practice Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Practice/Clinic Name
            </label>
            <input
              type="text"
              value={formData.practice_name || ''}
              onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="City Mental Health Clinic"
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (emailError) setEmailError(''); // Clear error on change
                }}
                onBlur={handleEmailBlur}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  emailError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="provider@clinic.com"
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {emailError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (phoneError) setPhoneError(''); // Clear error on change
                }}
                onBlur={handlePhoneBlur}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  phoneError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="+254785778988"
              />
              {phoneError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {phoneError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Format: +[country code][number] (e.g., +254785778988)
              </p>
            </div>
          </div>

          {/* Specialty & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialty *
              </label>
              <select
                required
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value as ProviderSpecialty })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(SPECIALTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProviderStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes about this provider..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : provider ? 'Update Provider' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// Referrals Slide-out Panel Component
// =============================================================================

interface ReferralsPanelProps {
  provider: Provider | null;
  isOpen: boolean;
  onClose: () => void;
}

// Contact outcome options for dropdown - INCLUDING Scheduled and Completed
const CONTACT_OUTCOME_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'ANSWERED', label: 'Answered', color: 'bg-green-100 text-green-800' },
  { value: 'NO_ANSWER', label: 'No Answer', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CALLBACK_REQUESTED', label: 'Callback Requested', color: 'bg-purple-100 text-purple-800' },
  { value: 'SCHEDULED', label: 'Scheduled', color: 'bg-teal-100 text-teal-800' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'UNREACHABLE', label: 'Unreachable', color: 'bg-red-100 text-red-800' },
  { value: 'NOT_INTERESTED', label: 'Not Interested', color: 'bg-gray-100 text-gray-800' },
];

const getOutcomeColor = (outcome: string) => {
  const found = CONTACT_OUTCOME_OPTIONS.find(o => o.value === outcome);
  return found ? found.color : 'bg-gray-100 text-gray-800';
};

const ReferralsPanel: React.FC<ReferralsPanelProps> = ({
  provider,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [_callingLeadId, _setCallingLeadId] = useState<string | null>(null);
  void _setCallingLeadId;
  const [callStatus, setCallStatus] = useState<{ success?: string; error?: string }>({});
  const [updatingOutcomeId, setUpdatingOutcomeId] = useState<string | null>(null);

  // Fetch referrals for this provider
  const { data: referralsData, isLoading, refetch } = useQuery({
    queryKey: ['provider-referrals', provider?.id],
    queryFn: () => listLeads({ page: 1, page_size: 50 }),
    enabled: isOpen && !!provider,
  });

  // Filter leads that belong to this provider (isReferral and referringProviderId match)
  const referrals = referralsData?.items?.filter(
    (lead: ILeadListItem) => lead.isReferral && lead.referringProviderId === provider?.id
  ) || [];

  const handleCallLead = (lead: ILeadListItem) => {
    if (!lead.phone) {
      setCallStatus({ error: 'No phone number available' });
      return;
    }

    // Use tel: link for 3CX Chrome extension click-to-call
    const cleaned = lead.phone.replace(/[^\d+]/g, '');
    const digits = cleaned.replace(/^\+/, '').replace(/\+/g, '');
    let telUri: string;
    if (digits.startsWith('1') && digits.length === 11) {
      telUri = `tel:+${digits}`;
    } else if (digits.length === 10) {
      telUri = `tel:+1${digits}`;
    } else if (cleaned.startsWith('+')) {
      telUri = `tel:+${digits}`;
    } else {
      telUri = `tel:+1${digits}`;
    }

    console.log('[3CX Click-to-Call] Triggering:', telUri);
    window.location.href = telUri;
    setCallStatus({ success: `Calling ${lead.firstName} via 3CX...` });
    setTimeout(() => setCallStatus({}), 3000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl z-50 transform transition-transform duration-300">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <User size={24} className="text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {provider?.name}'s Referrals
                </h2>
                <p className="text-sm text-gray-500">
                  {referrals.length} referral{referrals.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-500" />
            </button>
          </div>

          {/* Call Status */}
          {(callStatus.success || callStatus.error) && (
            <div className={`px-6 py-3 ${callStatus.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <PhoneCall size={16} className={callStatus.success ? 'text-green-600' : 'text-red-600'} />
                <span className={`text-sm ${callStatus.success ? 'text-green-700' : 'text-red-700'}`}>
                  {callStatus.success || callStatus.error}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg" />
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No referrals yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Referrals from this provider will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {referrals.map((lead: ILeadListItem) => {
                  const handleOutcomeChange = async (newOutcome: string) => {
                    setUpdatingOutcomeId(lead.id);
                    try {
                      await updateContactOutcome(lead.id, { contact_outcome: newOutcome as ContactOutcome });
                      refetch();
                      queryClient.invalidateQueries({ queryKey: ['leads'] });
                    } catch (err) {
                      console.error('Failed to update contact outcome:', err);
                    } finally {
                      setUpdatingOutcomeId(null);
                    }
                  };

                  return (
                    <div
                      key={lead.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-700">
                              {lead.firstName?.charAt(0) || '?'}{lead.lastName?.charAt(0) || ''}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{lead.condition}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`
                                inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full
                                ${lead.priority === 'hot' ? 'bg-red-100 text-red-700' :
                                  lead.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'}
                              `}>
                                {lead.priority}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(lead.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Call Button */}
                        {lead.phone && (
                          <button
                            onClick={() => handleCallLead(lead)}
                            disabled={_callingLeadId === lead.id}
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
                              transition-colors duration-200
                              ${_callingLeadId === lead.id
                                ? 'bg-yellow-100 text-yellow-700 cursor-wait'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'}
                            `}
                          >
                            {_callingLeadId === lead.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <PhoneCall size={16} />
                            )}
                            {_callingLeadId === lead.id ? 'Calling...' : 'Call'}
                          </button>
                        )}
                      </div>

                      {/* Contact Outcome & Info Row */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-sm">
                        {/* Contact Outcome Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">Outcome:</span>
                          <select
                            value={lead.contactOutcome || 'NEW'}
                            onChange={(e) => handleOutcomeChange(e.target.value)}
                            disabled={updatingOutcomeId === lead.id}
                            className={`
                              text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer
                              focus:ring-2 focus:ring-blue-500
                              ${updatingOutcomeId === lead.id ? 'opacity-50' : ''}
                              ${getOutcomeColor(lead.contactOutcome || 'NEW')}
                            `}
                          >
                            {CONTACT_OUTCOME_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {updatingOutcomeId === lead.id && (
                            <Loader2 size={12} className="animate-spin text-gray-400" />
                          )}
                        </div>

                        {/* Contact Info */}
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone size={14} />
                            <span className="font-mono">{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Mail size={14} />
                            <span>{lead.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Providers Table Component
// =============================================================================

interface ProvidersTableProps {
  providers: Provider[];
  isLoading: boolean;
  onEdit: (provider: Provider) => void;
  onArchive: (providerId: string) => void;
  onViewReferrals: (provider: Provider) => void;
  onStatusChange: (providerId: string, status: ProviderStatus) => void;
}

const ProvidersTable: React.FC<ProvidersTableProps> = ({
  providers,
  isLoading,
  onEdit,
  onArchive,
  onViewReferrals,
  onStatusChange,
}) => {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No providers found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add a new provider or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Provider
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Specialty
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Referrals
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversion
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Referral
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {providers.map((provider) => (
            <tr key={provider.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {provider.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                    {provider.practice_name && (
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Building2 size={12} />
                        {provider.practice_name}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {provider.email ? (
                  <a
                    href={`mailto:${provider.email}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <Mail size={14} />
                    {provider.email}
                  </a>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900">
                  {getSpecialtyLabel(provider.specialty)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <select
                  value={provider.status}
                  onChange={(e) => onStatusChange(provider.id, e.target.value as ProviderStatus)}
                  className={`
                    text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer
                    focus:ring-2 focus:ring-blue-500
                    ${STATUS_COLORS[provider.status]}
                  `}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <span className="text-sm font-semibold text-gray-900">
                  {provider.total_referrals}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <span className={`text-sm font-semibold ${
                  provider.conversion_rate >= 50 ? 'text-green-600' :
                  provider.conversion_rate >= 25 ? 'text-yellow-600' :
                  'text-gray-500'
                }`}>
                  {provider.conversion_rate.toFixed(1)}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {provider.last_referral_at 
                  ? new Date(provider.last_referral_at).toLocaleDateString()
                  : 'Never'
                }
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewReferrals(provider)}
                    className="text-blue-600 hover:text-blue-900"
                    title="View Referrals"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => onEdit(provider)}
                    className="text-gray-600 hover:text-gray-900"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  {provider.status !== 'archived' && (
                    <button
                      onClick={() => onArchive(provider.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Archive"
                    >
                      <Archive size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// Main Dashboard Component
// =============================================================================

export const ProvidersDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ProviderFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [referralsProvider, setReferralsProvider] = useState<Provider | null>(null);
  const [isReferralsPanelOpen, setIsReferralsPanelOpen] = useState(false);

  // Fetch providers
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: providerKeys.list(filters, page),
    queryFn: () => getProviders(page, 20, filters),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: providerKeys.stats(),
    queryFn: getProviderStats,
  });

  // State for mutation errors
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);

  // Clear notifications after timeout
  useEffect(() => {
    if (mutationError || mutationSuccess) {
      const timer = setTimeout(() => {
        setMutationError(null);
        setMutationSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [mutationError, mutationSuccess]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProvider,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setIsModalOpen(false);
      setMutationSuccess(`Provider "${data.name}" created successfully!`);
    },
    onError: (error: Error) => {
      console.error('Create provider error:', error);
      setMutationError(error.message || 'Failed to create provider. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProviderUpdateRequest }) =>
      updateProvider(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setIsModalOpen(false);
      setEditingProvider(null);
      setMutationSuccess(`Provider "${data.name}" updated successfully!`);
    },
    onError: (error: Error) => {
      console.error('Update provider error:', error);
      setMutationError(error.message || 'Failed to update provider. Please try again.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setMutationSuccess('Provider archived successfully!');
    },
    onError: (error: Error) => {
      console.error('Archive provider error:', error);
      setMutationError(error.message || 'Failed to archive provider. Please try again.');
    },
  });

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchQuery || undefined }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSave = (data: ProviderCreateRequest | ProviderUpdateRequest) => {
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data });
    } else {
      createMutation.mutate(data as ProviderCreateRequest);
    }
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setIsModalOpen(true);
  };

  const handleArchive = (providerId: string) => {
    if (confirm('Are you sure you want to archive this provider?')) {
      archiveMutation.mutate(providerId);
    }
  };

  const handleViewReferrals = (provider: Provider) => {
    // Open slide-out panel with this provider's referrals
    setReferralsProvider(provider);
    setIsReferralsPanelOpen(true);
  };

  const handleStatusChange = (providerId: string, status: ProviderStatus) => {
    updateMutation.mutate({ id: providerId, data: { status } });
  };

  // Handle navigation for sidebar
  const handleNavigate = useCallback((page: string) => {
    if ((window as any).navigateTo) {
      (window as any).navigateTo(page);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar currentPage="providers" onNavigate={handleNavigate} />

      {/* Main Content */}
      <main className="ml-60 p-6">
        {/* Notification Toasts */}
        {(mutationSuccess || mutationError) && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
            {mutationSuccess && (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg shadow-lg">
                <CheckCircle size={20} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">{mutationSuccess}</span>
                <button onClick={() => setMutationSuccess(null)} className="text-green-500 hover:text-green-700">
                  <X size={16} />
                </button>
              </div>
            )}
            {mutationError && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg shadow-lg">
                <AlertCircle size={20} className="text-red-600" />
                <span className="text-sm font-medium text-red-800">{mutationError}</span>
                <button onClick={() => setMutationError(null)} className="text-red-500 hover:text-red-700">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Referring Providers</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage healthcare providers who refer patients to your clinic
              </p>
            </div>
          </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Providers"
            value={stats?.total_providers ?? 0}
            subtitle={`${stats?.active_providers ?? 0} active`}
            icon={<Users className="text-blue-600" size={24} />}
            color="bg-blue-100"
          />
          <KPICard
            title="Total Referrals"
            value={stats?.total_referrals ?? 0}
            subtitle={`${stats?.referrals_this_month ?? 0} this month`}
            icon={<UserPlus className="text-green-600" size={24} />}
            color="bg-green-100"
          />
          <KPICard
            title="Avg. Conversion Rate"
            value={`${(stats?.overall_conversion_rate ?? 0).toFixed(1)}%`}
            subtitle="Referral to patient"
            icon={<TrendingUp className="text-purple-600" size={24} />}
            color="bg-purple-100"
          />
          <KPICard
            title="Pending Verification"
            value={stats?.pending_providers ?? 0}
            subtitle="Providers to review"
            icon={<Clock className="text-amber-600" size={24} />}
            color="bg-amber-100"
          />
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search providers by name, practice, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filters.status || ''}
              onChange={(e) => {
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as ProviderStatus || undefined,
                }));
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Specialty Filter */}
            <select
              value={filters.specialty || ''}
              onChange={(e) => {
                setFilters((prev) => ({
                  ...prev,
                  specialty: e.target.value as ProviderSpecialty || undefined,
                }));
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Specialties</option>
              {Object.entries(SPECIALTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Add Provider Button */}
            <button
              onClick={() => {
                setEditingProvider(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={20} />
              Add Provider
            </button>
          </div>
        </div>

        {/* Providers Table with Scrolling */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="max-h-[500px] overflow-auto">
            <ProvidersTable
              providers={providersData?.items ?? []}
              isLoading={providersLoading}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onViewReferrals={handleViewReferrals}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Pagination */}
          {providersData && providersData.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, providersData.total)} of {providersData.total} providers
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!providersData.has_previous}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {page} of {providersData.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!providersData.has_next}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top Providers Card */}
        {stats?.top_providers && stats.top_providers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referring Providers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.top_providers.slice(0, 6).map((provider, index) => (
                <div
                  key={provider.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{provider.name}</p>
                    <p className="text-sm text-gray-500">
                      {provider.total_referrals} referrals • {provider.conversion_rate.toFixed(0)}% conv.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      </main>

      {/* Add/Edit Modal */}
      <ProviderFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProvider(null);
        }}
        provider={editingProvider}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Referrals Slide-out Panel */}
      <ReferralsPanel
        provider={referralsProvider}
        isOpen={isReferralsPanelOpen}
        onClose={() => {
          setIsReferralsPanelOpen(false);
          setReferralsProvider(null);
        }}
      />
    </div>
  );
};

export default ProvidersDashboard;
