/**
 * QuickActionPanel Component — v4.0 (Fix 3: Unified Action Dialog)
 *
 * Production-ready DRAGGABLE FLOATING PANEL for rapid lead actions.
 *
 * DIALOG FLOW (state machine):
 *   actions → confirmation          (for call outcomes)
 *   actions → schedule_consultation (inline form)
 *   actions → schedule_callback     (inline form)
 *
 * OUTCOME ROUTING TABLE (New Leads / Contacted):
 *  Schedule Consultation → Scheduled queue, clears old tags, user-selected date
 *  Schedule Callback     → Callback queue, "Callback Requested" tag, user-selected date
 *  Answered              → Contacted queue
 *  No Answer             → Follow-up queue, "No Answer" tag, +1 day follow-up
 *  Unreachable           → Unreachable queue, "Unreachable" tag
 *  Not Interested        → Follow-up queue, "Not Interested" tag, +14 days
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Phone,
  PhoneCall,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckCircle,
  PhoneMissed,
  PhoneOff,
  Clock,
  Ban,
  Sparkles,
  User,
  Zap,
  Flame,
  ExternalLink,
  Stethoscope,
  FileText,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { CONTACT_OUTCOME_CONFIG, type ContactOutcome, type LeadTableRow } from '../../types/lead';
import { updateContactOutcome, createLeadNote, scheduleCallback } from '../../services/leads';

// =============================================================================
// Types
// =============================================================================

type DialogView = 'actions' | 'confirmation' | 'schedule_consultation' | 'schedule_callback';

const OUTCOME_ICONS: Record<ContactOutcome, React.ReactNode> = {
  NEW: <Sparkles size={18} className="text-blue-500" />,
  ANSWERED: <CheckCircle2 size={18} className="text-emerald-500" />,
  NO_ANSWER: <PhoneMissed size={18} className="text-amber-500" />,
  UNREACHABLE: <PhoneOff size={18} className="text-red-500" />,
  CALLBACK_REQUESTED: <Clock size={18} className="text-violet-500" />,
  NOT_INTERESTED: <Ban size={18} className="text-slate-500" />,
  SCHEDULED: <CheckCircle size={18} className="text-teal-500" />,
  COMPLETED: <CheckCircle size={18} className="text-green-500" />,
};

/** Human-readable descriptions for confirmation screen */
const OUTCOME_CONFIRM_TEXT: Record<string, { title: string; description: string; color: string }> = {
  ANSWERED: {
    title: 'Mark as Answered',
    description: 'Lead will move to the Contacted queue. Ready for scheduling.',
    color: 'text-emerald-700',
  },
  NO_ANSWER: {
    title: 'Mark as No Answer',
    description: 'Lead will move to Follow-up queue with "No Answer" tag. Auto follow-up in 1 day.',
    color: 'text-amber-700',
  },
  UNREACHABLE: {
    title: 'Mark as Unreachable',
    description: 'Lead will move to Unreachable queue with "Unreachable" tag.',
    color: 'text-red-700',
  },
  NOT_INTERESTED: {
    title: 'Mark as Not Interested',
    description: 'Lead will move to Follow-up queue with "Not Interested" tag. Auto follow-up in 14 days.',
    color: 'text-slate-700',
  },
};

interface QuickActionPanelProps {
  lead: LeadTableRow | null;
  isOpen: boolean;
  onClose: () => void;
  onOutcomeChange: (leadId: string, newOutcome: ContactOutcome) => void;
  onScheduleSuccess: () => void;
  onViewDetails: (leadId: string) => void;
  canEdit?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const QuickActionPanel: React.FC<QuickActionPanelProps> = ({
  lead,
  isOpen,
  onClose,
  onOutcomeChange,
  onScheduleSuccess,
  onViewDetails,
  canEdit = true,
}) => {
  // State
  const [dialogView, setDialogView] = useState<DialogView>('actions');
  const [pendingOutcome, setPendingOutcome] = useState<ContactOutcome | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Schedule form state (shared by consultation & callback views)
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Reset everything when panel opens or lead changes
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setDialogView('actions');
      setPendingOutcome(null);
      setNoteText('');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleError(null);
    }
  }, [isOpen, lead?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (dialogView !== 'actions') {
          setDialogView('actions');
          setPendingOutcome(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dialogView, onClose]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      const panel = panelRef.current;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width / 2;
        const minX = -window.innerWidth + rect.width / 2;
        const maxY = window.innerHeight - rect.height / 2;
        const minY = -window.innerHeight + rect.height / 2;
        setPosition({
          x: Math.max(minX, Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY)),
        });
      } else {
        setPosition({ x: newX, y: newY });
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ---- Step 1: User clicks outcome → show confirmation ----
  const handleOutcomeClick = useCallback((outcome: ContactOutcome) => {
    setPendingOutcome(outcome);
    setDialogView('confirmation');
  }, []);

  // ---- Step 2: User confirms outcome → execute immediately ----
  const handleConfirm = useCallback(async () => {
    if (!lead || !pendingOutcome || isUpdating) return;
    await executeOutcome(pendingOutcome);
  }, [lead, pendingOutcome, isUpdating]);

  // ---- Navigate to schedule views with default date/time ----
  const openScheduleView = useCallback((view: 'schedule_consultation' | 'schedule_callback') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    setScheduleTime(nextHour.toTimeString().slice(0, 5));
    setScheduleError(null);
    setDialogView(view);
  }, []);

  // ---- Schedule submit: calls scheduleCallback API directly ----
  const handleScheduleSubmit = useCallback(async (scheduleType: 'consultation' | 'callback') => {
    if (!lead || isUpdating) return;

    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please select both date and time');
      return;
    }

    const scheduledDt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledDt < new Date()) {
      setScheduleError('Cannot schedule in the past');
      return;
    }

    setIsUpdating(true);
    try {
      await scheduleCallback(lead.id, {
        scheduled_callback_at: scheduledDt.toISOString(),
        contact_method: 'PHONE',
        schedule_type: scheduleType,
        scheduled_notes: noteText.trim() || undefined,
      });

      // Save manual note if provided
      if (noteText.trim()) {
        try {
          await createLeadNote(lead.id, {
            note_text: noteText.trim(),
            note_type: 'manual',
          });
        } catch (err) {
          console.warn('Note save failed (non-blocking):', err);
        }
      }

      // Success toast
      const leadName = `${lead.firstName} ${lead.lastName || ''}`.trim();
      const dateStr = scheduledDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const toastMsg = scheduleType === 'consultation'
        ? `✓ Consultation scheduled for ${leadName} on ${dateStr}`
        : `✓ Callback scheduled for ${leadName} on ${dateStr}`;
      window.dispatchEvent(new CustomEvent('neuroreach:toast', {
        detail: { message: toastMsg, type: 'success' },
      }));

      onScheduleSuccess();
      onClose();
    } catch (error: any) {
      console.error(`Failed to schedule ${scheduleType}:`, error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to schedule. Please try again.';
      setScheduleError(errorMsg);
      window.dispatchEvent(new CustomEvent('neuroreach:toast', {
        detail: { message: errorMsg, type: 'error' },
      }));
    } finally {
      setIsUpdating(false);
    }
  }, [lead, isUpdating, scheduleDate, scheduleTime, noteText, onScheduleSuccess, onClose]);

  // ---- Core execution: call API, save note, notify parent ----
  const executeOutcome = useCallback(async (outcome: ContactOutcome, scheduledAt?: string) => {
    if (!lead) return;
    setIsUpdating(true);

    try {
      // 1. Update contact outcome via API
      await updateContactOutcome(lead.id, {
        contact_outcome: outcome,
        notes: noteText.trim() || undefined,
        next_follow_up_at: scheduledAt,
      });

      // 2. If user wrote a note, save it as a manual note (travels with lead)
      if (noteText.trim()) {
        try {
          await createLeadNote(lead.id, {
            note_text: noteText.trim(),
            note_type: 'manual',
          });
        } catch (err) {
          console.warn('Note save failed (non-blocking):', err);
        }
      }

      // 3. Build success toast
      const leadName = `${lead.firstName} ${lead.lastName || ''}`.trim();
      let toastMessage = '';
      switch (outcome) {
        case 'ANSWERED':
          toastMessage = `✓ ${leadName} moved to Contacted`;
          break;
        case 'NO_ANSWER':
          toastMessage = `✓ ${leadName} moved to Follow-up — No Answer`;
          break;
        case 'UNREACHABLE':
          toastMessage = `✓ ${leadName} moved to Unreachable`;
          break;
        case 'NOT_INTERESTED':
          toastMessage = `✓ ${leadName} moved to Follow-up — Not Interested`;
          break;
        default:
          toastMessage = `✓ ${leadName} outcome updated`;
      }
      if (toastMessage) {
        window.dispatchEvent(new CustomEvent('neuroreach:toast', {
          detail: { message: toastMessage, type: 'success' },
        }));
      }

      // 4. Notify parent of the change
      onOutcomeChange(lead.id, outcome);
      onClose();
    } catch (error: any) {
      console.error('Failed to update outcome:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to update outcome. Please try again.';
      window.dispatchEvent(new CustomEvent('neuroreach:toast', {
        detail: { message: errorMsg, type: 'error' },
      }));
      // Go back to confirmation on error
      setDialogView('confirmation');
    } finally {
      setIsUpdating(false);
    }
  }, [lead, noteText, onOutcomeChange, onClose]);

  if (!isOpen || !lead) return null;

  const currentOutcome = lead.contactOutcome || 'NEW';
  const outcomes: ContactOutcome[] = ['ANSWERED', 'NO_ANSWER', 'UNREACHABLE', 'NOT_INTERESTED'];

  return (
    <>
      {/* Light backdrop */}
      <div className="fixed inset-0 bg-black/5 z-40 transition-opacity duration-200 pointer-events-none" />

      {/* DRAGGABLE FLOATING PANEL */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          className={`
            pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl
            transition-shadow duration-300 overflow-hidden border border-gray-200
            ${isDragging ? 'shadow-3xl cursor-grabbing' : 'cursor-default'}
          `}
        >
          {/* Header — DRAGGABLE */}
          <div
            className={`relative bg-gradient-to-r from-slate-800 to-slate-900 text-white px-5 py-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
            onMouseDown={handleMouseDown}
          >
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-10"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                lead.priority === 'hot' ? 'bg-red-500/20' :
                lead.priority === 'medium' ? 'bg-amber-500/20' : 'bg-slate-500/20'
              }`}>
                {lead.priority === 'hot' ? <Flame size={24} className="text-red-400" /> :
                 lead.priority === 'medium' ? <Zap size={24} className="text-amber-400" /> :
                 <User size={24} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-tight truncate">{lead.firstName} {lead.lastName}</h3>
                <p className="text-slate-300 text-sm truncate">{lead.condition}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-mono text-slate-400 bg-slate-700/50 px-2 py-1 rounded">{lead.leadId}</span>
              <Badge variant="priority" value={lead.priority} size="sm" />
              <Badge variant="status" value={lead.status} size="sm" />
            </div>
          </div>

          {/* Current Status Banner */}
          <div className={`px-5 py-3 flex items-center justify-between ${CONTACT_OUTCOME_CONFIG[currentOutcome].bgColor} border-b ${CONTACT_OUTCOME_CONFIG[currentOutcome].borderColor}`}>
            <div className="flex items-center gap-2">
              {OUTCOME_ICONS[currentOutcome]}
              <div>
                <p className={`font-semibold text-sm ${CONTACT_OUTCOME_CONFIG[currentOutcome].color}`}>{CONTACT_OUTCOME_CONFIG[currentOutcome].label}</p>
                <p className="text-xs text-gray-500">{lead.contactAttempts ? `${lead.contactAttempts} attempt${lead.contactAttempts > 1 ? 's' : ''}` : 'No attempts yet'}</p>
              </div>
            </div>
            {lead.contactAttempts && lead.contactAttempts > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/60 rounded-full">
                <Phone size={12} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-600">{lead.contactAttempts}</span>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* VIEW: ACTIONS (default — unified layout) */}
          {/* ================================================================= */}
          {dialogView === 'actions' && canEdit && (
            <>
              {/* Notes */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={13} className="text-gray-400" />
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Note (optional — saved with any action)</label>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this interaction..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              {/* Schedule Section */}
              <div className="px-5 py-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Calendar size={14} />
                  Schedule
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openScheduleView('schedule_consultation')}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                      <Stethoscope size={16} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-sm text-emerald-700">Consultation</p>
                    </div>
                    <ArrowRight size={14} className="text-emerald-400 flex-shrink-0" />
                  </button>
                  <button
                    onClick={() => openScheduleView('schedule_callback')}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-300 transition-all active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center">
                      <CalendarPlus size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-sm text-violet-700">Callback</p>
                    </div>
                    <ArrowRight size={14} className="text-violet-400 flex-shrink-0" />
                  </button>
                </div>
              </div>

              {/* Outcome Buttons */}
              <div className="px-5 pb-5 pt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <PhoneCall size={14} />
                  Record Call Outcome
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {outcomes.map((outcome) => {
                    const config = CONTACT_OUTCOME_CONFIG[outcome];
                    const isCurrent = currentOutcome === outcome;
                    return (
                      <button
                        key={outcome}
                        onClick={() => handleOutcomeClick(outcome)}
                        className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                          isCurrent
                            ? `${config.bgColor} ${config.borderColor} ring-2 ${config.ringColor} ring-opacity-50`
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } cursor-pointer group hover:scale-[1.02] active:scale-[0.98]`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${config.bgColor} ${config.borderColor}`}>
                            {OUTCOME_ICONS[outcome]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm ${config.color}`}>{config.label}</p>
                          </div>
                          <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ================================================================= */}
          {/* VIEW: CONFIRMATION */}
          {/* ================================================================= */}
          {dialogView === 'confirmation' && pendingOutcome && canEdit && (
            <div className="px-5 py-5 space-y-4">
              {/* Back button */}
              <button
                onClick={() => { setDialogView('actions'); setPendingOutcome(null); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back to actions
              </button>

              {/* Confirmation card */}
              <div className={`rounded-xl border-2 p-4 ${CONTACT_OUTCOME_CONFIG[pendingOutcome].bgColor} ${CONTACT_OUTCOME_CONFIG[pendingOutcome].borderColor}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${CONTACT_OUTCOME_CONFIG[pendingOutcome].bgColor} ${CONTACT_OUTCOME_CONFIG[pendingOutcome].borderColor}`}>
                    {OUTCOME_ICONS[pendingOutcome]}
                  </div>
                  <div>
                    <h4 className={`font-bold text-base ${OUTCOME_CONFIRM_TEXT[pendingOutcome]?.color || 'text-gray-700'}`}>
                      {OUTCOME_CONFIRM_TEXT[pendingOutcome]?.title || pendingOutcome}
                    </h4>
                    <p className="text-sm text-gray-600">{OUTCOME_CONFIRM_TEXT[pendingOutcome]?.description}</p>
                  </div>
                </div>

                {/* Note preview */}
                {noteText.trim() && (
                  <div className="mt-3 p-2 bg-white/60 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">📝 Note will be saved:</p>
                    <p className="text-sm text-gray-700">{noteText.trim()}</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setDialogView('actions'); setPendingOutcome(null); }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <><Loader2 size={18} className="animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 size={18} /> Confirm</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: SCHEDULE CONSULTATION (inline form) */}
          {/* ================================================================= */}
          {dialogView === 'schedule_consultation' && canEdit && (
            <div className="px-5 py-5 space-y-4">
              <button
                onClick={() => setDialogView('actions')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                  <Stethoscope size={24} className="text-emerald-600" />
                </div>
                <h4 className="font-bold text-gray-900">Schedule Consultation</h4>
                <p className="text-sm text-gray-500">Book consultation for {lead.firstName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Calendar size={12} className="inline mr-1" />Date
                  </label>
                  <input type="date" value={scheduleDate}
                    onChange={(e) => { setScheduleDate(e.target.value); setScheduleError(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Clock size={12} className="inline mr-1" />Time
                  </label>
                  <input type="time" value={scheduleTime}
                    onChange={(e) => { setScheduleTime(e.target.value); setScheduleError(null); }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
              </div>
              {scheduleError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle size={16} /><span className="text-sm">{scheduleError}</span>
                </div>
              )}
              {scheduleDate && scheduleTime && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-sm text-emerald-800">
                    <strong>Consultation:</strong>{' '}
                    {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDialogView('actions')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  Back
                </button>
                <button onClick={() => handleScheduleSubmit('consultation')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUpdating ? <><Loader2 size={18} className="animate-spin" /> Scheduling...</> : <><Stethoscope size={18} /> Schedule</>}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: SCHEDULE CALLBACK (inline form) */}
          {/* ================================================================= */}
          {dialogView === 'schedule_callback' && canEdit && (
            <div className="px-5 py-5 space-y-4">
              <button
                onClick={() => setDialogView('actions')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-violet-100 flex items-center justify-center mb-2">
                  <CalendarPlus size={24} className="text-violet-600" />
                </div>
                <h4 className="font-bold text-gray-900">Schedule Callback</h4>
                <p className="text-sm text-gray-500">When should we call {lead.firstName} back?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Calendar size={12} className="inline mr-1" />Date
                  </label>
                  <input type="date" value={scheduleDate}
                    onChange={(e) => { setScheduleDate(e.target.value); setScheduleError(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Clock size={12} className="inline mr-1" />Time
                  </label>
                  <input type="time" value={scheduleTime}
                    onChange={(e) => { setScheduleTime(e.target.value); setScheduleError(null); }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
                </div>
              </div>
              {scheduleError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle size={16} /><span className="text-sm">{scheduleError}</span>
                </div>
              )}
              {scheduleDate && scheduleTime && (
                <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                  <p className="text-sm text-violet-800">
                    <strong>Callback:</strong>{' '}
                    {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDialogView('actions')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  Back
                </button>
                <button onClick={() => handleScheduleSubmit('callback')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUpdating ? <><Loader2 size={18} className="animate-spin" /> Scheduling...</> : <><CalendarPlus size={18} /> Schedule Callback</>}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">Submitted {new Date(lead.submittedAt).toLocaleDateString()}</span>
            <button
              onClick={() => onViewDetails(lead.id)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              View Full Profile
              <ExternalLink size={14} />
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="px-5 py-2 bg-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-[10px]">Esc</kbd> to {dialogView !== 'actions' ? 'go back' : 'close'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickActionPanel;
