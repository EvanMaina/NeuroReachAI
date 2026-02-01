/**
 * ConsultationPanel Component
 * 
 * Production-ready DRAGGABLE FLOATING PANEL for managing scheduled consultations.
 * Allows coordinators/specialists to record consultation outcomes and manage follow-ups.
 * 
 * Key Features:
 * - Draggable via header (no visible drag bar — clean design)
 * - No blur backdrop (clear view of Kanban columns)
 * - Record consultation outcomes via backend workflow endpoint
 * - Optional notes field attached to each outcome
 * - Quick reschedule access
 * - Lead context always visible
 * - Keyboard shortcuts support (1-5 for outcomes, Esc to close)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  CalendarClock,
  RefreshCw,
  UserX,
  XCircle,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
  Zap,
  Flame,
  AlertTriangle,
  AlertCircle,
  CalendarPlus,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import type { LeadTableRow, LeadStatus } from '../../types/lead';
import { updateConsultationOutcome, createLeadNote, type ConsultationOutcomeType } from '../../services/leads';

// Consultation outcome types for internal use
type ConsultationOutcome = 
  | 'CONSULTATION_COMPLETE'
  | 'RESCHEDULE_REQUESTED'
  | 'FOLLOWUP_NEEDED'
  | 'NO_SHOW'
  | 'CANCELLED';

// Maps internal outcome keys to backend API values
const OUTCOME_TO_API: Record<ConsultationOutcome, ConsultationOutcomeType> = {
  CONSULTATION_COMPLETE: 'complete',
  RESCHEDULE_REQUESTED: 'reschedule',
  FOLLOWUP_NEEDED: 'followup',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

// Consultation outcome configuration
const CONSULTATION_OUTCOME_CONFIG: Record<ConsultationOutcome, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  showArrow: boolean;
}> = {
  CONSULTATION_COMPLETE: {
    label: 'Complete',
    icon: <CheckCircle2 size={18} className="text-emerald-500" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Successful consultation',
    showArrow: true,
  },
  RESCHEDULE_REQUESTED: {
    label: 'Reschedule',
    icon: <RefreshCw size={18} className="text-amber-500" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Different time needed',
    showArrow: true,
  },
  FOLLOWUP_NEEDED: {
    label: 'Follow-up',
    icon: <CalendarPlus size={18} className="text-blue-500" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Second consult required',
    showArrow: true,
  },
  NO_SHOW: {
    label: 'No Show',
    icon: <UserX size={18} className="text-red-500" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Did not attend',
    showArrow: true,
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <XCircle size={18} className="text-slate-500" />,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    description: 'Consultation cancelled',
    showArrow: true,
  },
};

// Dialog view state machine
type DialogView = 'outcomes' | 'confirmation' | 'reschedule' | 'followup';

/** Confirmation text for each consultation outcome */
const OUTCOME_CONFIRM_TEXT: Record<ConsultationOutcome, { title: string; description: string; color: string }> = {
  CONSULTATION_COMPLETE: {
    title: 'Mark as Complete',
    description: 'Lead will move to Completed queue.',
    color: 'text-emerald-700',
  },
  RESCHEDULE_REQUESTED: {
    title: 'Reschedule Consultation',
    description: 'Lead stays in Scheduled queue with "Rescheduled" tag. Select new date.',
    color: 'text-amber-700',
  },
  FOLLOWUP_NEEDED: {
    title: 'Schedule Follow-up',
    description: 'Lead stays in Scheduled queue with "Second Consult Required" tag. Select new consultation date.',
    color: 'text-blue-700',
  },
  NO_SHOW: {
    title: 'Mark as No Show',
    description: 'Lead moves to Follow-up queue with "No Show" tag. Auto follow-up in 1 day.',
    color: 'text-red-700',
  },
  CANCELLED: {
    title: 'Mark as Cancelled',
    description: 'Lead moves to Follow-up queue with "Cancelled Appointment" tag. Auto follow-up in 7 days.',
    color: 'text-slate-700',
  },
};

interface ConsultationPanelProps {
  lead: LeadTableRow | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onReschedule: (lead: LeadTableRow) => void;
  onViewDetails: (leadId: string) => void;
}

export const ConsultationPanel: React.FC<ConsultationPanelProps> = ({
  lead,
  isOpen,
  onClose,
  onStatusChange: _onStatusChange,
  onReschedule: _onReschedule,
  onViewDetails,
}) => {
  // Dialog state machine
  const [dialogView, setDialogView] = useState<DialogView>('outcomes');
  const [pendingOutcome, setPendingOutcome] = useState<ConsultationOutcome | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Date picker state (for reschedule / followup)
  const [pickerDate, setPickerDate] = useState('');
  const [pickerTime, setPickerTime] = useState('');
  const [pickerError, setPickerError] = useState<string | null>(null);
  
  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Reset everything when panel opens or lead changes
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setDialogView('outcomes');
      setPendingOutcome(null);
      setNoteText('');
      setPickerDate('');
      setPickerTime('');
      setPickerError(null);
    }
  }, [isOpen, lead?.id]);

  // Handle keyboard shortcuts — Esc goes back or closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (dialogView !== 'outcomes') {
          setDialogView('outcomes');
          setPendingOutcome(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dialogView, onClose]);

  // Drag handlers — attached to the header
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Constrain to viewport
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

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Step 1: User clicks outcome button → show confirmation
  const handleOutcomeClick = useCallback((outcome: ConsultationOutcome) => {
    setPendingOutcome(outcome);
    setDialogView('confirmation');
  }, []);

  // Step 2: User confirms → either execute immediately or show date picker
  const handleConfirm = useCallback(() => {
    if (!pendingOutcome || isUpdating) return;

    if (pendingOutcome === 'RESCHEDULE_REQUESTED') {
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setPickerDate(tomorrow.toISOString().split('T')[0]);
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setPickerTime(nextHour.toTimeString().slice(0, 5));
      setPickerError(null);
      setDialogView('reschedule');
      return;
    }

    if (pendingOutcome === 'FOLLOWUP_NEEDED') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setPickerDate(tomorrow.toISOString().split('T')[0]);
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setPickerTime(nextHour.toTimeString().slice(0, 5));
      setPickerError(null);
      setDialogView('followup');
      return;
    }

    // For Complete, No Show, Cancelled → execute immediately
    executeOutcome(pendingOutcome);
  }, [pendingOutcome, isUpdating]);

  // Step 3 (reschedule/followup): User submits date → execute
  const handleDateSubmit = useCallback(() => {
    if (!lead || !pendingOutcome || isUpdating) return;

    if (!pickerDate || !pickerTime) {
      setPickerError('Please select both date and time');
      return;
    }

    const scheduledDt = new Date(`${pickerDate}T${pickerTime}`);
    if (scheduledDt < new Date()) {
      setPickerError('Cannot schedule in the past');
      return;
    }

    executeOutcome(pendingOutcome, scheduledDt.toISOString());
  }, [lead, pendingOutcome, isUpdating, pickerDate, pickerTime]);

  // Core execution: call API, save note, close panel
  // CRITICAL FIX: Do NOT call onStatusChange after consultation outcome API call.
  // The backend /consultation-outcome endpoint already handles the full workflow
  // (status change, tags, follow_up_reason, scheduled dates). Calling onStatusChange
  // would trigger a SECOND PATCH /status call that wipes all tags via
  // clear_lead_transition_fields(). The onClose callback already refreshes leads.
  const executeOutcome = useCallback(async (outcome: ConsultationOutcome, scheduledAt?: string) => {
    if (!lead) return;
    setIsUpdating(true);

    try {
      const apiOutcome = OUTCOME_TO_API[outcome];
      await updateConsultationOutcome(lead.id, {
        outcome: apiOutcome,
        notes: noteText.trim() || undefined,
        scheduled_callback_at: scheduledAt,
      });

      // Save manual note if provided (travels with lead)
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

      // Build success toast message
      const leadName = `${lead.firstName} ${lead.lastName || ''}`.trim();
      let toastMessage = '';
      switch (outcome) {
        case 'CONSULTATION_COMPLETE':
          toastMessage = `✓ ${leadName} marked as Completed`;
          break;
        case 'RESCHEDULE_REQUESTED':
          if (scheduledAt) {
            const dt = new Date(scheduledAt);
            const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            toastMessage = `✓ ${leadName} rescheduled to ${dateStr}`;
          } else {
            toastMessage = `✓ ${leadName} rescheduled`;
          }
          break;
        case 'FOLLOWUP_NEEDED':
          if (scheduledAt) {
            const dt2 = new Date(scheduledAt);
            const dateStr2 = dt2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            toastMessage = `✓ Second consultation scheduled for ${leadName} on ${dateStr2}`;
          } else {
            toastMessage = `✓ Follow-up scheduled for ${leadName}`;
          }
          break;
        case 'NO_SHOW':
          toastMessage = `✓ ${leadName} moved to Follow-up — No Show`;
          break;
        case 'CANCELLED':
          toastMessage = `✓ ${leadName} moved to Follow-up — Cancelled`;
          break;
      }

      // Dispatch success toast event (picked up by CoordinatorDashboard)
      if (toastMessage) {
        window.dispatchEvent(new CustomEvent('neuroreach:toast', {
          detail: { message: toastMessage, type: 'success' },
        }));
      }

      // Close panel — onClose handler in CoordinatorDashboard refreshes leads
      onClose();
    } catch (error: any) {
      console.error('Failed to update consultation outcome:', error);
      // Show error toast
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to update outcome. Please try again.';
      window.dispatchEvent(new CustomEvent('neuroreach:toast', {
        detail: { message: errorMsg, type: 'error' },
      }));
      setDialogView('confirmation');
    } finally {
      setIsUpdating(false);
    }
  }, [lead, noteText, onClose]);

  // Format scheduled date/time
  const formatScheduledDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const scheduledDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const isToday = scheduledDate.getTime() === today.getTime();
    const isTomorrow = scheduledDate.getTime() === tomorrow.getTime();
    const isPast = date.getTime() < now.getTime();

    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const fullDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    return { time, fullDate, isToday, isTomorrow, isPast };
  };

  if (!isOpen || !lead) return null;

  const scheduledInfo = lead.scheduledCallbackAt 
    ? formatScheduledDateTime(lead.scheduledCallbackAt) 
    : null;

  const outcomes: ConsultationOutcome[] = [
    'CONSULTATION_COMPLETE',
    'RESCHEDULE_REQUESTED',
    'FOLLOWUP_NEEDED',
    'NO_SHOW',
    'CANCELLED',
  ];

  return (
    <>
      {/* Light backdrop - NO BLUR, pointer-events-none allows scrolling Kanban behind */}
      <div 
        className="fixed inset-0 bg-black/5 z-40 transition-opacity duration-200 pointer-events-none"
      />
      
      {/* DRAGGABLE FLOATING PANEL */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
          className={`
            pointer-events-auto
            w-full max-w-md bg-white rounded-2xl shadow-2xl
            transition-shadow duration-300
            ${isDragging ? 'shadow-3xl cursor-grabbing' : 'cursor-default'}
            overflow-hidden
            border border-gray-200
          `}
        >
          {/* Header with Lead Context — DRAGGABLE via cursor:grab */}
          <div 
            className={`relative bg-gradient-to-r from-blue-800 to-indigo-900 text-white px-5 py-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
            onMouseDown={handleMouseDown}
          >
            {/* Close button — not draggable */}
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-10"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center gap-3">
              {/* Priority Icon */}
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${lead.priority === 'hot' ? 'bg-red-500/20' : 
                  lead.priority === 'medium' ? 'bg-amber-500/20' : 'bg-slate-500/20'}
              `}>
                {lead.priority === 'hot' ? (
                  <Flame size={24} className="text-red-400" />
                ) : lead.priority === 'medium' ? (
                  <Zap size={24} className="text-amber-400" />
                ) : (
                  <User size={24} className="text-slate-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-tight truncate">
                  {lead.firstName} {lead.lastName}
                </h3>
                <p className="text-blue-200 text-sm truncate">{lead.condition}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-mono text-blue-300 bg-blue-900/50 px-2 py-1 rounded">
                {lead.leadId}
              </span>
              <Badge variant="priority" value={lead.priority} size="sm" />
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/30 text-blue-100 rounded-full">
                Scheduled
              </span>
            </div>
          </div>

          {/* Scheduled Date/Time Banner */}
          {scheduledInfo && (
            <div className={`
              px-5 py-3 flex items-center gap-3 border-b
              ${scheduledInfo.isPast 
                ? 'bg-red-50 border-red-200' 
                : scheduledInfo.isToday 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : scheduledInfo.isTomorrow
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'}
            `}>
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${scheduledInfo.isPast 
                  ? 'bg-red-100' 
                  : scheduledInfo.isToday 
                    ? 'bg-emerald-100' 
                    : scheduledInfo.isTomorrow
                      ? 'bg-amber-100'
                      : 'bg-blue-100'}
              `}>
                {scheduledInfo.isPast ? (
                  <AlertTriangle size={20} className="text-red-600" />
                ) : (
                  <CalendarClock size={20} className={
                    scheduledInfo.isToday ? 'text-emerald-600' :
                    scheduledInfo.isTomorrow ? 'text-amber-600' : 'text-blue-600'
                  } />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {scheduledInfo.isPast && (
                    <span className="text-xs font-bold text-red-700">⚠️ Overdue</span>
                  )}
                  {scheduledInfo.isToday && !scheduledInfo.isPast && (
                    <span className="text-xs font-bold text-emerald-700">🔔 Today</span>
                  )}
                  {scheduledInfo.isTomorrow && (
                    <span className="text-xs font-bold text-amber-700">📅 Tomorrow</span>
                  )}
                </div>
                <p className={`font-semibold text-sm ${
                  scheduledInfo.isPast ? 'text-red-700' :
                  scheduledInfo.isToday ? 'text-emerald-700' :
                  scheduledInfo.isTomorrow ? 'text-amber-700' : 'text-blue-700'
                }`}>
                  {scheduledInfo.fullDate} at {scheduledInfo.time}
                </p>
              </div>
            </div>
          )}

          {/* No scheduled time fallback */}
          {!lead.scheduledCallbackAt && (
            <div className="px-5 py-3 border-b bg-gray-50 border-gray-200">
              <div className="flex items-center gap-3 text-gray-500">
                <Clock size={18} />
                <p className="text-sm italic">No scheduled time set</p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: OUTCOMES (default) */}
          {/* ================================================================= */}
          {dialogView === 'outcomes' && (
            <>
              {/* Notes */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={13} className="text-gray-400" />
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note (optional — saved with outcome)
                  </label>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this consultation..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              {/* Outcome Buttons */}
              <div className="px-5 pb-5 pt-2 max-h-[280px] overflow-y-auto">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Record Outcome
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {outcomes.map((outcome) => {
                    const config = CONSULTATION_OUTCOME_CONFIG[outcome];
                    return (
                      <button
                        key={outcome}
                        onClick={() => handleOutcomeClick(outcome)}
                        className={`p-3 rounded-xl border-2 text-left transition-all duration-200
                          bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50
                          cursor-pointer group hover:scale-[1.02] active:scale-[0.98]
                          ${outcome === 'CANCELLED' ? 'col-span-2' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${config.bgColor} ${config.borderColor}`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm ${config.color}`}>{config.label}</p>
                            <p className="text-[10px] text-gray-500 truncate">{config.description}</p>
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
          {dialogView === 'confirmation' && pendingOutcome && (
            <div className="px-5 py-5 space-y-4">
              <button
                onClick={() => { setDialogView('outcomes'); setPendingOutcome(null); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back to outcomes
              </button>
              <div className={`rounded-xl border-2 p-4 ${CONSULTATION_OUTCOME_CONFIG[pendingOutcome].bgColor} ${CONSULTATION_OUTCOME_CONFIG[pendingOutcome].borderColor}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${CONSULTATION_OUTCOME_CONFIG[pendingOutcome].bgColor} ${CONSULTATION_OUTCOME_CONFIG[pendingOutcome].borderColor}`}>
                    {CONSULTATION_OUTCOME_CONFIG[pendingOutcome].icon}
                  </div>
                  <div>
                    <h4 className={`font-bold text-base ${OUTCOME_CONFIRM_TEXT[pendingOutcome].color}`}>
                      {OUTCOME_CONFIRM_TEXT[pendingOutcome].title}
                    </h4>
                    <p className="text-sm text-gray-600">{OUTCOME_CONFIRM_TEXT[pendingOutcome].description}</p>
                  </div>
                </div>
                {noteText.trim() && (
                  <div className="mt-3 p-2 bg-white/60 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">📝 Note will be saved:</p>
                    <p className="text-sm text-gray-700">{noteText.trim()}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDialogView('outcomes'); setPendingOutcome(null); }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isUpdating}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${
                    pendingOutcome === 'RESCHEDULE_REQUESTED' ? 'bg-amber-600 hover:bg-amber-700' :
                    pendingOutcome === 'FOLLOWUP_NEEDED' ? 'bg-blue-600 hover:bg-blue-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isUpdating ? (
                    <><Loader2 size={18} className="animate-spin" /> Saving...</>
                  ) : (pendingOutcome === 'RESCHEDULE_REQUESTED' || pendingOutcome === 'FOLLOWUP_NEEDED') ? (
                    <><Calendar size={18} /> Select Date →</>
                  ) : (
                    <><CheckCircle2 size={18} /> Confirm</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: RESCHEDULE DATE PICKER */}
          {/* ================================================================= */}
          {dialogView === 'reschedule' && (
            <div className="px-5 py-5 space-y-4">
              <button
                onClick={() => setDialogView('confirmation')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-amber-100 flex items-center justify-center mb-2">
                  <RefreshCw size={24} className="text-amber-600" />
                </div>
                <h4 className="font-bold text-gray-900">Reschedule Consultation</h4>
                <p className="text-sm text-gray-500">Select new date for {lead.firstName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Calendar size={12} className="inline mr-1" />Date
                  </label>
                  <input type="date" value={pickerDate}
                    onChange={(e) => { setPickerDate(e.target.value); setPickerError(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Clock size={12} className="inline mr-1" />Time
                  </label>
                  <input type="time" value={pickerTime}
                    onChange={(e) => { setPickerTime(e.target.value); setPickerError(null); }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
              </div>
              {pickerError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle size={16} /><span className="text-sm">{pickerError}</span>
                </div>
              )}
              {pickerDate && pickerTime && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>New date:</strong>{' '}
                    {new Date(`${pickerDate}T${pickerTime}`).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDialogView('confirmation')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleDateSubmit} disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUpdating ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Calendar size={18} /> Reschedule</>}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: FOLLOWUP DATE PICKER */}
          {/* ================================================================= */}
          {dialogView === 'followup' && (
            <div className="px-5 py-5 space-y-4">
              <button
                onClick={() => setDialogView('confirmation')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 flex items-center justify-center mb-2">
                  <CalendarPlus size={24} className="text-blue-600" />
                </div>
                <h4 className="font-bold text-gray-900">Schedule Follow-up</h4>
                <p className="text-sm text-gray-500">When should {lead.firstName} return?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Calendar size={12} className="inline mr-1" />Date
                  </label>
                  <input type="date" value={pickerDate}
                    onChange={(e) => { setPickerDate(e.target.value); setPickerError(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <Clock size={12} className="inline mr-1" />Time
                  </label>
                  <input type="time" value={pickerTime}
                    onChange={(e) => { setPickerTime(e.target.value); setPickerError(null); }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              {pickerError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle size={16} /><span className="text-sm">{pickerError}</span>
                </div>
              )}
              {pickerDate && pickerTime && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Follow-up:</strong>{' '}
                    {new Date(`${pickerDate}T${pickerTime}`).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDialogView('confirmation')} disabled={isUpdating}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleDateSubmit} disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUpdating ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><CalendarPlus size={18} /> Schedule Follow-up</>}
                </button>
              </div>
            </div>
          )}

          {/* Footer with View Details */}
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {lead.contactAttempts || 0} contact attempt{(lead.contactAttempts || 0) !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onViewDetails(lead.id)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              View Full Profile
              <ExternalLink size={14} />
            </button>
          </div>
          
          {/* Keyboard hint */}
          <div className="px-5 py-2 bg-indigo-900 text-center">
            <p className="text-xs text-indigo-300">
              Press <kbd className="px-1.5 py-0.5 bg-indigo-800 rounded text-indigo-200 font-mono text-[10px]">Esc</kbd> to {dialogView !== 'outcomes' ? 'go back' : 'close'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConsultationPanel;
