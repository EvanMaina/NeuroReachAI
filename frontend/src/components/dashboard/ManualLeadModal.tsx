/**
 * ManualLeadModal — Add Lead form for coordinators
 *
 * Allows manual entry of a new lead directly from the Coordinator Dashboard.
 * Only first_name is required; all other fields are optional.
 * Creates the lead via POST /api/leads/manual with HOT priority.
 * Shown ONLY in the "New Leads" queue.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createManualLead, type IManualLeadRequest } from '../../services/leads';

interface ManualLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Condition options — values MUST match backend ConditionType enum exactly:
 * DEPRESSION, ANXIETY, OCD, PTSD, OTHER
 */
const CONDITION_OPTIONS = [
  { value: '', label: 'Select condition...' },
  { value: 'DEPRESSION', label: 'Depression' },
  { value: 'ANXIETY', label: 'Anxiety' },
  { value: 'OCD', label: 'OCD' },
  { value: 'PTSD', label: 'PTSD' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Urgency options — values MUST match backend UrgencyType enum exactly:
 * ASAP, WITHIN_30_DAYS, EXPLORING
 */
const URGENCY_OPTIONS = [
  { value: '', label: 'Select urgency...' },
  { value: 'ASAP', label: 'Urgent — needs immediate attention' },
  { value: 'WITHIN_30_DAYS', label: 'Soon — within 30 days' },
  { value: 'EXPLORING', label: 'Exploring — just researching' },
];

export const ManualLeadModal: React.FC<ManualLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [condition, setCondition] = useState('');
  const [conditionOther, setConditionOther] = useState('');
  const [urgency, setUrgency] = useState('');
  const [hasInsurance, setHasInsurance] = useState<boolean | undefined>(undefined);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ leadNumber: string } | null>(null);

  // Track mounted state to prevent setState on unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCondition('');
    setConditionOther('');
    setUrgency('');
    setHasInsurance(undefined);
    setInsuranceProvider('');
    setZipCode('');
    setNotes('');
    setError(null);
    setSuccess(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required field
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setError('First name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: IManualLeadRequest = {
        first_name: trimmedFirst,
      };

      // Only include non-empty optional fields
      if (lastName.trim()) payload.last_name = lastName.trim();
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (condition) payload.condition = condition;
      if (condition === 'OTHER' && conditionOther.trim()) {
        payload.condition_other = conditionOther.trim();
      }
      if (urgency) payload.urgency = urgency;
      if (hasInsurance !== undefined) payload.has_insurance = hasInsurance;
      if (hasInsurance && insuranceProvider.trim()) {
        payload.insurance_provider = insuranceProvider.trim();
      }
      if (zipCode.trim()) payload.zip_code = zipCode.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const response = await createManualLead(payload);

      if (!isMountedRef.current) return;
      setSuccess({ leadNumber: response.lead_number });

      // Auto-close after 1.5s on success — guard with isMountedRef so we never
      // call setState on an already-unmounted component.
      setTimeout(() => {
        if (!isMountedRef.current) return;
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      // FastAPI Pydantic 422 errors return detail as an ARRAY:
      //   [{ loc: [...], msg: "...", type: "..." }]
      // If we set that array directly into string state and render <p>{error}</p>,
      // React throws "Objects are not valid as a React child" → ErrorBoundary crash.
      // We MUST always coerce detail to a string before calling setError().
      let message = 'Failed to create lead. Please try again.';

      const axiosErr = err as {
        response?: { data?: { detail?: unknown } };
        message?: string;
      };
      const detail = axiosErr?.response?.data?.detail;

      if (typeof detail === 'string' && detail.trim()) {
        // Backend raised an explicit HTTPException with a string message
        message = detail.trim();
      } else if (Array.isArray(detail) && detail.length > 0) {
        // FastAPI Pydantic validation error — pick the first human-readable message
        const firstErr = detail[0] as { msg?: string; message?: string };
        const raw = firstErr?.msg ?? firstErr?.message ?? '';
        message = raw.trim()
          ? `Validation error: ${raw.trim()}`
          : 'Validation error. Please check your inputs.';
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [
    firstName, lastName, email, phone, condition, conditionOther,
    urgency, hasInsurance, insuranceProvider, zipCode, notes,
    handleClose, onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <UserPlus size={20} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add New Lead</h2>
                <p className="text-xs text-gray-500">Manual entry — assigned HOT priority</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Success State */}
          {success && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Lead Created!</h3>
              <p className="text-sm text-gray-500">
                Lead <span className="font-mono font-semibold text-emerald-600">{success.leadNumber}</span> added to the New Leads queue.
              </p>
            </div>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-4">
                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Name Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Contact Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Condition & Urgency Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white"
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Urgency
                    </label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white"
                    >
                      {URGENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Other Condition (conditional) */}
                {condition === 'OTHER' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Other Condition
                    </label>
                    <input
                      type="text"
                      value={conditionOther}
                      onChange={(e) => setConditionOther(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                )}

                {/* Insurance & Zip Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Insurance?
                    </label>
                    <select
                      value={hasInsurance === undefined ? '' : hasInsurance ? 'yes' : 'no'}
                      onChange={(e) => {
                        if (e.target.value === '') setHasInsurance(undefined);
                        else setHasInsurance(e.target.value === 'yes');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white"
                    >
                      <option value="">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      placeholder=""
                      disabled={!hasInsurance}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder=""
                      maxLength={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder=""
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !firstName.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Add Lead
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ManualLeadModal;
