/**
 * LeadEditModal Component
 * 
 * Modal for editing lead information.
 * Allows coordinators to update contact info, clinical data, and notes.
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Phone, Mail, MapPin, Stethoscope, Clock, Shield,
  Save, Loader2, AlertCircle, FileText, DollarSign, CheckCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { updateLead, type ILeadUpdateRequest } from '../../services/leads';
import type { Lead } from '../../types/lead';

interface LeadEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  isLoading: boolean;
  onSaveSuccess?: () => void;
}

// Condition options — MUST match backend ConditionType enum exactly:
// DEPRESSION, ANXIETY, OCD, PTSD, OTHER
const CONDITION_OPTIONS = [
  { value: '', label: '— Select Condition —' },
  { value: 'DEPRESSION', label: 'Depression' },
  { value: 'ANXIETY', label: 'Anxiety' },
  { value: 'OCD', label: 'OCD' },
  { value: 'PTSD', label: 'PTSD' },
  { value: 'OTHER', label: 'Other' },
];

// Urgency options — must match backend UrgencyType enum: ASAP, WITHIN_30_DAYS, EXPLORING
const URGENCY_OPTIONS = [
  { value: '', label: '— Select Urgency —' },
  { value: 'ASAP', label: 'ASAP - Very Urgent' },
  { value: 'WITHIN_30_DAYS', label: 'Within 30 Days' },
  { value: 'EXPLORING', label: 'Just Exploring' },
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'HOT', label: 'Hot', className: 'text-red-600' },
  { value: 'MEDIUM', label: 'Medium', className: 'text-yellow-600' },
  { value: 'LOW', label: 'Low', className: 'text-blue-600' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'CONSULTATION_COMPLETE', label: 'Consultation Complete' },
  { value: 'TREATMENT_STARTED', label: 'Treatment Started' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DISQUALIFIED', label: 'Disqualified' },
];

// Map frontend status values to backend enum values
// NULL-SAFE: Handles null/undefined/empty status from any lead source (Google Ads, JotForm, Widget)
const statusToBackend = (status: string | null | undefined): string => {
  if (!status) return 'NEW';
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'none') return 'NEW';
  const mapping: Record<string, string> = {
    'new': 'NEW',
    'contacted': 'CONTACTED',
    'scheduled': 'SCHEDULED',
    'consultation complete': 'CONSULTATION_COMPLETE',
    'consultation_complete': 'CONSULTATION_COMPLETE',
    'treatment started': 'TREATMENT_STARTED',
    'treatment_started': 'TREATMENT_STARTED',
    'lost': 'LOST',
    'disqualified': 'DISQUALIFIED',
  };
  return mapping[normalized] || status.toUpperCase().replace(/ /g, '_');
};

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  isOpen,
  onClose,
  lead,
  isLoading,
  onSaveSuccess,
}) => {
  // Form state
  const [formData, setFormData] = useState<ILeadUpdateRequest>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when lead changes or modal opens
  useEffect(() => {
    if (lead) {
      // Safely normalize values — prevent "null", "undefined", "NULL" from showing as text
      const safeStr = (val: string | null | undefined): string => {
        if (val == null) return '';
        const trimmed = String(val).trim();
        if (['null', 'undefined', 'none', 'NULL', 'UNDEFINED', 'NONE'].includes(trimmed)) return '';
        return trimmed;
      };
      
      const conditionVal = safeStr(lead.condition).toUpperCase();
      const urgencyVal = safeStr(lead.urgency).toUpperCase().replace(/ /g, '_');
      
      setFormData({
        first_name: safeStr(lead.firstName),
        last_name: safeStr(lead.lastName),
        email: safeStr(lead.email),
        phone: safeStr(lead.phone),
        condition: CONDITION_OPTIONS.some(o => o.value === conditionVal) ? conditionVal : '',
        symptom_duration: safeStr(lead.symptomDuration).toUpperCase().replace(/ /g, '_'),
        has_insurance: lead.hasInsurance ?? false,
        insurance_provider: safeStr(lead.insuranceProvider),
        zip_code: safeStr(lead.zipCode),
        urgency: URGENCY_OPTIONS.some(o => o.value === urgencyVal) ? urgencyVal : '',
        notes: safeStr(lead.notes),
        status: statusToBackend(lead.status || 'new'),
        priority: safeStr(lead.priority).toUpperCase() || 'LOW',
      });
      setError(null);
      setSaveSuccess(false);
    }
  }, [lead]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setIsSaving(true);
    setError(null);

    try {
      // Only send changed fields
      const changes: ILeadUpdateRequest = {};
      
      // NULL-SAFE comparisons: Use safeStr to normalize both sides identically
      // This prevents false positives from null vs '' vs 'null' mismatches
      // which caused crashes when saving Google Ads leads with many empty fields
      const safeStr = (val: string | null | undefined): string => {
        if (val == null) return '';
        const trimmed = String(val).trim();
        if (['null', 'undefined', 'none', 'NULL', 'UNDEFINED', 'NONE'].includes(trimmed)) return '';
        return trimmed;
      };

      if (safeStr(formData.first_name) !== safeStr(lead.firstName)) changes.first_name = formData.first_name;
      if (safeStr(formData.last_name) !== safeStr(lead.lastName)) changes.last_name = formData.last_name;
      if (safeStr(formData.email) !== safeStr(lead.email)) changes.email = formData.email;
      if (safeStr(formData.phone) !== safeStr(lead.phone)) changes.phone = formData.phone;
      if (safeStr(formData.condition) !== safeStr(lead.condition).toUpperCase()) changes.condition = formData.condition;
      if (safeStr(formData.urgency) !== safeStr(lead.urgency).toUpperCase().replace(/ /g, '_')) changes.urgency = formData.urgency;
      if ((formData.has_insurance ?? false) !== (lead.hasInsurance ?? false)) changes.has_insurance = formData.has_insurance;
      if (safeStr(formData.insurance_provider) !== safeStr(lead.insuranceProvider)) changes.insurance_provider = formData.insurance_provider;
      if (safeStr(formData.zip_code) !== safeStr(lead.zipCode)) changes.zip_code = formData.zip_code;
      if (safeStr(formData.notes) !== safeStr(lead.notes)) changes.notes = formData.notes;
      if (safeStr(formData.status) !== statusToBackend(lead.status)) changes.status = formData.status;
      if (safeStr(formData.priority) !== safeStr(lead.priority).toUpperCase()) changes.priority = formData.priority;

      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }

      await updateLead(lead.id, changes);
      
      // Show success feedback briefly before closing
      setIsSaving(false);
      setSaveSuccess(true);
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
      return; // skip finally block's setIsSaving
    } catch (err: any) {
      console.error('Failed to update lead:', err);
      // Extract specific error message from API response if available
      const apiMessage = err?.response?.data?.detail || err?.message;
      setError(apiMessage || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Footer with save/cancel buttons
  const footerContent = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="edit-lead-form"
        disabled={isSaving}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save size={18} />
            Save Changes
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Edit Lead" 
      size="lg" 
      footer={footerContent}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : lead ? (
        <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Success message */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
              <CheckCircle size={18} />
              <span>Lead updated successfully!</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Header with Lead ID */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <p className="text-sm text-gray-500 font-mono">{lead.leadId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="priority" value={lead.priority} size="md" />
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User size={16} className="text-gray-500" />
              Contact Information
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail size={14} className="inline mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone size={14} className="inline mr-1" />
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline mr-1" />
                ZIP Code
              </label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code || ''}
                onChange={handleChange}
                maxLength={10}
                placeholder="e.g. 85001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {formData.zip_code === '00000' && (
                <p className="mt-1 text-xs text-amber-600">
                  Placeholder ZIP from Google Ads — update with patient's actual ZIP code
                </p>
              )}
            </div>
          </div>

          {/* Clinical Information Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Stethoscope size={16} className="text-gray-500" />
              Clinical Information
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  name="condition"
                  value={formData.condition || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CONDITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Urgency
                </label>
                <select
                  name="urgency"
                  value={formData.urgency || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {URGENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Insurance Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Shield size={16} className="text-gray-500" />
              Insurance Information
            </h4>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="has_insurance"
                  checked={formData.has_insurance || false}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Has Insurance</span>
              </label>
            </div>

            {formData.has_insurance && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign size={14} className="inline mr-1" />
                  Insurance Provider
                </label>
                <input
                  type="text"
                  name="insurance_provider"
                  value={formData.insurance_provider || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Status & Priority Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText size={16} className="text-gray-500" />
              Lead Management
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className={opt.className}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Add coordinator notes..."
              />
            </div>
          </div>
        </form>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No lead selected
        </div>
      )}
    </Modal>
  );
};

export default LeadEditModal;
