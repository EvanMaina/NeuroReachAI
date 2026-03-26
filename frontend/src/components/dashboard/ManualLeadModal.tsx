/**
 * ManualLeadModal — Add Lead form for coordinators
 *
 * Allows manual entry of a new lead directly from the Coordinator Dashboard.
 * Only first_name is required; all other fields are optional.
 * Creates the lead via POST /api/leads/manual with HOT priority.
 * Shown ONLY in the "New Leads" queue.
 *
 * Features:
 * - Referral support: toggle "Was this lead referred?" with provider autocomplete
 * - Document attachments: drag-and-drop file upload for all leads
 * - All fields optional except first name
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X, UserPlus, Loader2, CheckCircle2, AlertCircle, UserCheck, ChevronDown,
  Upload, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip, Trash2
} from 'lucide-react';
import { createManualLead, type IManualLeadRequest } from '../../services/leads';
import { uploadAttachment, formatFileSize, notifyAttachmentsChanged } from '../../services/attachments';
import { searchProviders } from '../../services/providers';
import type { Provider } from '../../types/provider';
import { KNOWN_SPECIALTY_LABELS } from '../../types/provider';

interface ManualLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Condition options — values MUST match backend ConditionType enum exactly
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
 * Urgency options — values MUST match backend UrgencyType enum exactly
 */
const URGENCY_OPTIONS = [
  { value: '', label: 'Select urgency...' },
  { value: 'ASAP', label: 'Urgent — needs immediate attention' },
  { value: 'WITHIN_30_DAYS', label: 'Soon — within 30 days' },
  { value: 'EXPLORING', label: 'Exploring — just researching' },
];

/**
 * Common specialty options for the dropdown (free text also allowed)
 */
const SPECIALTY_OPTIONS = [
  '',
  'Psychiatrist',
  'Psychologist',
  'Therapist',
  'Primary Care',
  'Neurologist',
  'Social Worker',
  'Nurse Practitioner',
  'Other',
];

/** Max file size 25MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Accepted MIME types */
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
];

/** Get file type icon */
function getFileIcon(file: File) {
  const t = file.type;
  if (t.startsWith('image/')) return <ImageIcon size={14} className="text-pink-500" />;
  if (t.includes('spreadsheet') || t.includes('excel')) return <FileSpreadsheet size={14} className="text-green-600" />;
  if (t.includes('pdf')) return <FileText size={14} className="text-red-500" />;
  return <FileText size={14} className="text-blue-500" />;
}

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

  // Referral state
  const [isReferral, setIsReferral] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [providerContact, setProviderContact] = useState('');
  const [providerSpecialty, setProviderSpecialty] = useState('');
  const [providerSuggestions, setProviderSuggestions] = useState<Provider[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const providerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ leadNumber: string; uploadFailed?: boolean } | null>(null);

  // Track mounted state
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
    setIsReferral(false);
    setProviderName('');
    setProviderContact('');
    setProviderSpecialty('');
    setProviderSuggestions([]);
    setShowSuggestions(false);
    setPendingFiles([]);
    setFileErrors([]);
    setIsDragOver(false);
    setUploadProgress(null);
    setError(null);
    setSuccess(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // ---------------------------------------------------------------------------
  // Provider Autocomplete
  // ---------------------------------------------------------------------------

  const handleProviderNameChange = useCallback((value: string) => {
    setProviderName(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length < 2) {
      setProviderSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setIsSearching(true);
      try {
        const results = await searchProviders(value.trim(), 5);
        if (!isMountedRef.current) return;
        setProviderSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setProviderSuggestions([]);
        setShowSuggestions(false);
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    }, 300);
  }, []);

  const selectProvider = useCallback((provider: Provider) => {
    setProviderName(provider.name);
    setProviderContact(provider.email || provider.phone || '');
    setProviderSpecialty(provider.specialty || '');
    setShowSuggestions(false);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        providerInputRef.current && !providerInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // ---------------------------------------------------------------------------
  // File Upload Handling
  // ---------------------------------------------------------------------------

  const validateAndAddFiles = useCallback((files: FileList | File[]) => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds 25MB limit (${formatFileSize(file.size)})`);
        return;
      }
      if (ACCEPTED_TYPES.length > 0 && !ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" — unsupported file type (${file.type || 'unknown'})`);
        return;
      }
      // Check for duplicates by name
      if (pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
        return; // silently skip duplicate
      }
      validFiles.push(file);
    });

    if (errors.length > 0) setFileErrors(errors);
    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
      // Clear errors after 5 seconds
      if (errors.length > 0) setTimeout(() => setFileErrors([]), 5000);
    }
  }, [pendingFiles]);

  const removeFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [validateAndAddFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }, [validateAndAddFiles]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setError('First name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: IManualLeadRequest = { first_name: trimmedFirst };

      if (lastName.trim()) payload.last_name = lastName.trim();
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (condition) payload.condition = condition;
      if (condition === 'OTHER' && conditionOther.trim()) payload.condition_other = conditionOther.trim();
      if (urgency) payload.urgency = urgency;
      if (hasInsurance !== undefined) payload.has_insurance = hasInsurance;
      if (hasInsurance && insuranceProvider.trim()) payload.insurance_provider = insuranceProvider.trim();
      if (zipCode.trim()) payload.zip_code = zipCode.trim();
      if (notes.trim()) payload.notes = notes.trim();

      // Referral fields
      if (isReferral && providerName.trim()) {
        payload.is_referral = true;
        payload.referring_provider_name = providerName.trim();
        if (providerContact.trim()) payload.referring_provider_contact = providerContact.trim();
        if (providerSpecialty.trim()) payload.referring_provider_specialty = providerSpecialty.trim();
      }

      const response = await createManualLead(payload);
      if (!isMountedRef.current) return;

      // Upload pending files (non-blocking — lead already created)
      let uploadFailed = false;
      let uploadedAny = false;
      if (pendingFiles.length > 0) {
        setUploadProgress(`Uploading ${pendingFiles.length} file(s)...`);
        for (let i = 0; i < pendingFiles.length; i++) {
          if (!isMountedRef.current) return;
          setUploadProgress(`Uploading ${i + 1}/${pendingFiles.length}: ${pendingFiles[i].name}`);
          try {
            await uploadAttachment(response.lead_id, pendingFiles[i]);
            uploadedAny = true;
          } catch {
            uploadFailed = true;
          }
        }
        setUploadProgress(null);
      }

      if (uploadedAny) {
        notifyAttachmentsChanged(response.lead_id);
      }

      if (!isMountedRef.current) return;
      setSuccess({ leadNumber: response.lead_number, uploadFailed });

      setTimeout(() => {
        if (!isMountedRef.current) return;
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      let message = 'Failed to create lead. Please try again.';
      const axiosErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        message = detail.trim();
      } else if (Array.isArray(detail) && detail.length > 0) {
        const firstErr = detail[0] as { msg?: string; message?: string };
        const raw = firstErr?.msg ?? firstErr?.message ?? '';
        message = raw.trim() ? `Validation error: ${raw.trim()}` : 'Validation error. Please check your inputs.';
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
        setUploadProgress(null);
      }
    }
  }, [
    firstName, lastName, email, phone, condition, conditionOther,
    urgency, hasInsurance, insuranceProvider, zipCode, notes,
    isReferral, providerName, providerContact, providerSpecialty,
    pendingFiles, handleClose, onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50 transition-opacity" onClick={handleClose} />

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
            <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
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
              {isReferral && providerName.trim() && (
                <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                  <UserCheck size={12} /> Referral from {providerName.trim()} linked
                </p>
              )}
              {pendingFiles.length > 0 && !success.uploadFailed && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <Paperclip size={12} /> {pendingFiles.length} file(s) attached
                </p>
              )}
              {success.uploadFailed && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Some files failed to upload — add them from the lead profile
                </p>
              )}
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
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      autoFocus required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors" />
                  </div>
                </div>

                {/* Contact Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors" />
                  </div>
                </div>

                {/* Condition & Urgency Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Condition</label>
                    <select value={condition} onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white">
                      {CONDITION_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Urgency</label>
                    <select value={urgency} onChange={(e) => setUrgency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white">
                      {URGENCY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                </div>

                {/* Other Condition (conditional) */}
                {condition === 'OTHER' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Other Condition</label>
                    <input type="text" value={conditionOther} onChange={(e) => setConditionOther(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors" />
                  </div>
                )}

                {/* Insurance & Zip Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Insurance?</label>
                    <select value={hasInsurance === undefined ? '' : hasInsurance ? 'yes' : 'no'}
                      onChange={(e) => { if (e.target.value === '') setHasInsurance(undefined); else setHasInsurance(e.target.value === 'yes'); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white">
                      <option value="">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Insurance Provider</label>
                    <input type="text" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} disabled={!hasInsurance}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Zip Code</label>
                    <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} maxLength={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors" />
                  </div>
                </div>

                {/* ============================================================= */}
                {/* Referral Section                                               */}
                {/* ============================================================= */}
                <div className={`rounded-2xl border transition-all duration-300 ${isReferral ? 'border-purple-300 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 shadow-sm shadow-purple-100/60' : 'border-gray-200 bg-gray-50/70'}`}>
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2.5">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 ${isReferral ? 'border-purple-200 bg-white text-purple-600 shadow-sm' : 'border-gray-200 bg-white text-gray-400'}`}>
                            <UserCheck size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">Was this lead referred?</p>
                            <p className="text-[11px] text-gray-500">Toggle on to link the referring provider details.</p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-auto flex items-center gap-2.5 rounded-full border border-white/70 bg-white/80 px-2.5 py-1.5 shadow-sm shadow-purple-100/50 backdrop-blur">
                        <span
                          className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                            isReferral
                              ? 'bg-purple-100 text-purple-700 shadow-sm'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isReferral ? 'Yes' : 'No'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isReferral}
                          aria-label="Was this lead referred?"
                          onClick={() => setIsReferral((prev) => !prev)}
                          className={`relative inline-flex h-9 w-[4.5rem] items-center rounded-full border px-1 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                            isReferral
                              ? 'border-purple-500 bg-gradient-to-r from-purple-600 via-violet-500 to-fuchsia-500 shadow-lg shadow-purple-200/70'
                              : 'border-gray-300 bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-1 left-1 rounded-full bg-white/20 transition-all duration-300 ${
                              isReferral ? 'w-[calc(100%-0.5rem)] opacity-100' : 'w-0 opacity-0'
                            }`}
                          />
                          <span
                            aria-hidden="true"
                            className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-[0_8px_20px_rgba(76,29,149,0.18)] transition-transform duration-300 ease-out ${
                              isReferral ? 'translate-x-[1.7rem]' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`grid overflow-hidden transition-all duration-300 ease-out ${isReferral ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="min-h-0">
                      <div className="px-4 pb-4 space-y-3 border-t border-purple-200/70 bg-white/70">
                      <div className="relative">
                        <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Provider Name</label>
                        <div className="relative">
                          <input ref={providerInputRef} type="text" value={providerName}
                            onChange={(e) => handleProviderNameChange(e.target.value)}
                            onFocus={() => { if (providerSuggestions.length > 0) setShowSuggestions(true); }}
                            placeholder="Start typing to search providers..."
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors bg-white" />
                          {isSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />}
                        </div>
                        {showSuggestions && providerSuggestions.length > 0 && (
                          <div ref={suggestionsRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                            {providerSuggestions.map((p) => (
                              <button key={p.id} type="button" onClick={() => selectProvider(p)}
                                className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0">
                                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                                <p className="text-xs text-gray-500">
                                  {p.specialty && <span>{KNOWN_SPECIALTY_LABELS[p.specialty] || p.specialty}</span>}
                                  {p.specialty && (p.email || p.phone) && <span> · </span>}
                                  {p.email || p.phone || ''}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Provider Contact</label>
                          <input type="text" value={providerContact} onChange={(e) => setProviderContact(e.target.value)} placeholder="Email or phone"
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Specialty</label>
                          <div className="relative">
                            <select value={SPECIALTY_OPTIONS.includes(providerSpecialty) ? providerSpecialty : '__custom__'}
                              onChange={(e) => { if (e.target.value !== '__custom__') setProviderSpecialty(e.target.value); }}
                              className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors bg-white appearance-none pr-8">
                              <option value="">Select specialty...</option>
                              {SPECIALTY_OPTIONS.filter(Boolean).map((s) => (<option key={s} value={s}>{s}</option>))}
                              {providerSpecialty && !SPECIALTY_OPTIONS.includes(providerSpecialty) && (<option value="__custom__">{providerSpecialty}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-purple-500">
                        A "Ref: {providerName || 'Provider'}" tag will be added. The provider will appear in the Providers dashboard.
                      </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* Document Attachments — available for ALL leads                 */}
                {/* ============================================================= */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Paperclip size={12} />
                    Attachments
                  </label>

                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      relative flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-lg border-2 border-dashed cursor-pointer transition-all
                      ${isDragOver
                        ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
                        : 'border-gray-300 bg-gray-50/50 hover:border-emerald-400 hover:bg-emerald-50/30'
                      }
                    `}
                  >
                    <Upload size={20} className={isDragOver ? 'text-emerald-500' : 'text-gray-400'} />
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-emerald-600">Browse files</span> or drag & drop
                    </p>
                    <p className="text-[10px] text-gray-400">PDF, Word, Excel, Images — max 25MB each</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {/* File Errors */}
                  {fileErrors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {fileErrors.map((err, i) => (
                        <p key={i} className="text-[11px] text-red-500 flex items-center gap-1">
                          <AlertCircle size={10} /> {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Pending Files List */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {pendingFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                          <div className="flex-shrink-0 w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                            {getFileIcon(file)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                            className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-none" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                {uploadProgress && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1.5 mr-auto">
                    <Loader2 size={12} className="animate-spin" /> {uploadProgress}
                  </p>
                )}
                <button type="button" onClick={handleClose} disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !firstName.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (<><Loader2 size={16} className="animate-spin" />Creating...</>) : (<><UserPlus size={16} />Add Lead</>)}
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
