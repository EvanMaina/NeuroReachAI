/**
 * LeadDetailModal Component
 * 
 * Displays full lead information when View is clicked.
 * Includes notes section, enum formatting, and lead score color coding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, MapPin, Calendar, FileText, Send, Clock, User } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Lead } from '../../types/lead';
import { getLeadNotes, createLeadNote, type ILeadNote } from '../../services/leads';
import { formatCondition, formatDuration, formatTreatments, formatUrgency, getScoreColor, getScoreTier } from '../../utils/enumFormatters';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  isLoading: boolean;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  lead,
  isLoading,
}) => {
  const [notes, setNotes] = useState<ILeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Load notes when lead changes
  useEffect(() => {
    if (isOpen && lead?.id) {
      loadNotes(lead.id);
    }
  }, [isOpen, lead?.id]);

  const loadNotes = useCallback(async (leadId: string) => {
    setNotesLoading(true);
    try {
      const data = await getLeadNotes(leadId);
      // Fix 5: Only show manual notes in Lead Details — system/outcome notes are internal
      setNotes(data.filter((n: ILeadNote) => n.note_type === 'manual'));
    } catch (err) {
      console.error('Failed to load notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const handleSubmitNote = useCallback(async () => {
    if (!lead?.id || !newNoteText.trim() || isSubmittingNote) return;
    
    setIsSubmittingNote(true);
    try {
      const created = await createLeadNote(lead.id, {
        note_text: newNoteText.trim(),
        note_type: 'manual',
      });
      setNotes(prev => [created, ...prev]);
      setNewNoteText('');
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  }, [lead?.id, newNoteText, isSubmittingNote]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNoteDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lead Details" size="lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : lead ? (
        <div className="space-y-6">
          {/* Header with Priority & Status */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {lead.firstName} {lead.lastName}
              </h3>
              <p className="text-sm text-gray-500 font-mono">{lead.leadId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="priority" value={lead.priority} size="md" />
              <Badge variant="status" value={lead.status} size="md" />
            </div>
          </div>

          {/* Lead Score — Color coded */}
          {(() => {
            const scoreColors = getScoreColor(lead.leadScore);
            const scoreTier = getScoreTier(lead.leadScore);
            return (
              <div className={`rounded-lg p-4 border ${scoreColors.bg} ${scoreColors.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${scoreColors.text}`}>Lead Score</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${scoreColors.bg} ${scoreColors.text} border ${scoreColors.border}`}>
                      {scoreTier}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${scoreColors.text}`}>{lead.leadScore}</span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${scoreColors.dot}`}
                    style={{ width: `${Math.min(lead.leadScore, 200) / 2}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="text-gray-400" size={20} />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <a href={`mailto:${lead.email}`} className="text-sm text-blue-600 hover:underline">
                  {lead.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="text-gray-400" size={20} />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 hover:underline">
                  {lead.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="text-gray-400" size={20} />
              <div>
                <p className="text-xs text-gray-500">ZIP Code</p>
                <p className="text-sm text-gray-900">
                  {lead.zipCode} 
                  {lead.isInServiceArea ? (
                    <span className="ml-2 text-green-600 text-xs">(In Service Area)</span>
                  ) : (
                    <span className="ml-2 text-red-600 text-xs">(Out of Area)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="text-gray-400" size={20} />
              <div>
                <p className="text-xs text-gray-500">Submitted</p>
                <p className="text-sm text-gray-900">{formatDate(lead.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Clinical Info — with enum formatting */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Clinical Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Primary Condition:</span>
                <span className="ml-2 text-gray-900">{formatCondition(lead.primaryCondition)}</span>
              </div>
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 text-gray-900">{formatDuration(lead.symptomDuration)}</span>
              </div>
              {lead.urgency && (
                <div>
                  <span className="text-gray-500">Urgency:</span>
                  <span className="ml-2 text-gray-900">{formatUrgency(lead.urgency)}</span>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-gray-500">Prior Treatments:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {lead.priorTreatments.length > 0 ? (
                    <span className="text-gray-900">{formatTreatments(lead.priorTreatments)}</span>
                  ) : (
                    <span className="text-gray-400">None reported</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Insurance</h4>
            <p className="text-sm text-gray-900">
              {lead.hasInsurance ? (
                <>
                  <span className="text-green-600">✓</span> {lead.insuranceProvider || 'Provider not specified'}
                </>
              ) : (
                <span className="text-gray-500">No insurance / Self-pay</span>
              )}
            </p>
          </div>

          {/* Attribution */}
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Attribution</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {lead.utmSource && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    Source: {lead.utmSource}
                  </span>
                )}
                {lead.utmMedium && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    Medium: {lead.utmMedium}
                  </span>
                )}
                {lead.utmCampaign && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    Campaign: {lead.utmCampaign}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-gray-500" />
              Notes
            </h4>

            {/* Add Note Form */}
            <div className="mb-4">
              <div className="flex gap-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmitNote();
                    }
                  }}
                />
                <button
                  onClick={handleSubmitNote}
                  disabled={!newNoteText.trim() || isSubmittingNote}
                  className="self-end px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Add note (Ctrl+Enter)"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Press Ctrl+Enter to submit</p>
            </div>

            {/* Notes List */}
            {notesLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-gray-500">Loading notes...</span>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No notes yet</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <User size={12} className="text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {note.created_by_name || 'System'}
                        </span>
                        {note.note_type === 'outcome' && note.related_outcome && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded">
                            {note.related_outcome.replace(/_/g, ' ')}
                          </span>
                        )}
                        {note.note_type === 'system' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock size={10} />
                        {formatNoteDate(note.created_at)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Lead not found
        </div>
      )}
    </Modal>
  );
};
