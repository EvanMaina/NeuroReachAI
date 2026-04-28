/**
 * LeadDetailModal Component
 * 
 * Displays full lead information when View is clicked.
 * Includes notes section, enum formatting, and lead score color coding.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, Mail, MapPin, Calendar, FileText, Send, Clock, User, Edit2, Trash2, X, Paperclip, Download, Image, FileSpreadsheet, Upload, Loader2, Plus, Megaphone, ExternalLink } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Lead } from '../../types/lead';
import { getLeadNotes, createLeadNote, type ILeadNote } from '../../services/leads';
import { listAttachments, uploadAttachment, downloadAttachment, deleteAttachment, formatFileSize, notifyAttachmentsChanged, type IAttachment } from '../../services/attachments';
import { useAuth } from '../../hooks/useAuth';
import { formatCondition, formatDuration, formatTreatments, formatUrgency, formatTMSInterest, getScoreColor, getScoreTier } from '../../utils/enumFormatters';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  isLoading: boolean;
  /** Called when the user clicks "Edit Lead" — parent should open LeadEditModal */
  onEdit?: (leadId: string) => void;
  /** Called when the user clicks "Delete Lead" — parent should open delete confirmation */
  onDelete?: (leadId: string, leadName: string) => void;
  /** Whether the current user has permission to delete leads (admin/primary_admin only) */
  canDelete?: boolean;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  lead,
  isLoading,
  onEdit,
  onDelete,
  canDelete = false,
}) => {
  const { user } = useAuth();

  const [notes, setNotes] = useState<ILeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Attachment state
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachDownloading, setAttachDownloading] = useState<string | null>(null);
  const [attachDeleting, setAttachDeleting] = useState<string | null>(null);
  const [attachDeleteConfirm, setAttachDeleteConfirm] = useState<string | null>(null);
  const [attachDragActive, setAttachDragActive] = useState(false);
  const attachFileInputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async (leadId: string) => {
    setNotesLoading(true);
    try {
      const data = await getLeadNotes(leadId);
      setNotes(data);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const loadAttachments = useCallback(async (leadId: string) => {
    setAttachmentsLoading(true);
    try {
      const data = await listAttachments(leadId);
      setAttachments(data);
    } catch {
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  // Load notes and attachments when lead changes
  useEffect(() => {
    if (isOpen && lead?.id) {
      loadNotes(lead.id);
      loadAttachments(lead.id);
    }
    if (!isOpen) {
      // Reset state when modal closes
      setAttachments([]);
      setAttachDeleteConfirm(null);
    }
  }, [isOpen, lead?.id, loadNotes, loadAttachments]);

  /** Get file type icon */
  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={16} className="text-pink-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={16} className="text-green-600" />;
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500" />;
    return <FileText size={16} className="text-blue-500" />;
  }, []);

  /** Whether current user can delete a given attachment */
  const canDeleteAttachment = useCallback((att: IAttachment): boolean => {
    if (!user) return false;
    const isAdmin = user.role === 'administrator' || user.role === 'primary_admin';
    const isUploader = att.uploaded_by_id === user.id;
    return isAdmin || isUploader;
  }, [user]);

  const handleAttachDownload = useCallback(async (leadId: string, att: IAttachment) => {
    setAttachDownloading(att.id);
    try {
      await downloadAttachment(leadId, att.id, att.filename);
    } catch { /* silent */ }
    finally { setAttachDownloading(null); }
  }, []);

  const handleAttachDeleteConfirmed = useCallback(async (leadId: string, attachmentId: string) => {
    setAttachDeleting(attachmentId);
    try {
      await deleteAttachment(leadId, attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      setAttachDeleteConfirm(null);
      notifyAttachmentsChanged(leadId);
    } catch { /* silent */ }
    finally { setAttachDeleting(null); }
  }, []);

  const handleAttachUpload = useCallback(async (leadId: string, files: FileList | File[]) => {
    setAttachUploading(true);
    const newItems: IAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const att = await uploadAttachment(leadId, files[i] as File);
        newItems.push(att);
      } catch { /* skip failed */ }
    }
    if (newItems.length > 0) {
      setAttachments(prev => [...newItems, ...prev]);
      notifyAttachmentsChanged(leadId);
    }
    setAttachUploading(false);
    if (attachFileInputRef.current) attachFileInputRef.current.value = '';
  }, []);

  /** Drag-and-drop handlers for attachments */
  const handleAttachDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttachDragActive(true);
  }, []);

  const handleAttachDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttachDragActive(false);
  }, []);

  const handleAttachDrop = useCallback((e: React.DragEvent, leadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setAttachDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAttachUpload(leadId, e.dataTransfer.files);
    }
  }, [handleAttachUpload]);

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
      if (import.meta.env.DEV) console.error('Failed to create note:', err);
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
                {lead.leadLocation && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="text-gray-400">Coordinator note:</span> {lead.leadLocation}
                  </p>
                )}
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
              <div>
                <span className="text-gray-500">TMS Therapy Interest:</span>
                {lead.tmsTherapyInterest ? (
                  <span className="ml-2 text-gray-900">{formatTMSInterest(lead.tmsTherapyInterest)}</span>
                ) : (
                  <span className="ml-2 text-gray-400 italic">Not captured</span>
                )}
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
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.leadSource || lead.referrerUrl) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Megaphone size={16} className="text-indigo-500" />
                Where They Reached Us From
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {lead.leadSource && (
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded">
                    Lead source: {lead.leadSource.replace(/_/g, ' ')}
                  </span>
                )}
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
              {lead.referrerUrl && (
                <a
                  href={lead.referrerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-gray-600 hover:text-indigo-600"
                >
                  <ExternalLink size={12} />
                  <span className="truncate">{lead.referrerUrl}</span>
                </a>
              )}
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

          {/* ─── Attachments Section ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Paperclip size={16} className="text-amber-500" />
                Documents & Attachments
                {attachments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                    {attachments.length}
                  </span>
                )}
              </h4>
              <button
                onClick={() => attachFileInputRef.current?.click()}
                disabled={attachUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {attachUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {attachUploading ? "Uploading..." : "Upload"}
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={attachFileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0 && lead) {
                  handleAttachUpload(lead.id, e.target.files);
                }
              }}
            />

            {/* Drag-and-drop zone */}
            <div
              onDragOver={handleAttachDragOver}
              onDragLeave={handleAttachDragLeave}
              onDrop={(e) => lead && handleAttachDrop(e, lead.id)}
              className={`
                border-2 border-dashed rounded-lg p-3 mb-3 text-center transition-all cursor-pointer
                ${attachDragActive
                  ? "border-amber-400 bg-amber-50"
                  : "border-gray-200 bg-gray-50/50 hover:border-amber-300 hover:bg-amber-50/30"
                }
              `}
              onClick={() => attachFileInputRef.current?.click()}
            >
              <Upload size={18} className={`mx-auto mb-1 ${attachDragActive ? "text-amber-500" : "text-gray-400"}`} />
              <p className="text-xs text-gray-500">
                {attachDragActive ? "Drop files here..." : "Drag & drop files here, or click to browse"}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">PDF, Word, Excel, Images • Max 25MB each</p>
            </div>

            {/* Attachment List */}
            {attachmentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-amber-500" />
                <span className="ml-2 text-xs text-gray-500">Loading attachments...</span>
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No attachments yet</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {attachments.map((att) => (
                  <div key={att.id}>
                    {attachDeleteConfirm === att.id ? (
                      /* Delete Confirmation */
                      <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <Trash2 size={14} className="text-red-500 flex-shrink-0" />
                          <span className="text-xs text-red-700 font-medium truncate">Delete "{att.filename}"?</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <button
                            onClick={() => setAttachDeleteConfirm(null)}
                            className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                          >Cancel</button>
                          <button
                            onClick={() => lead && handleAttachDeleteConfirmed(lead.id, att.id)}
                            disabled={attachDeleting === att.id}
                            className="px-2.5 py-1 text-[11px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {attachDeleting === att.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Attachment Row */
                      <div className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors group/att">
                        {/* File Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          {getFileIcon(att.file_type)}
                        </div>
                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate" title={att.filename}>
                            {att.filename}
                          </p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <span>{formatFileSize(att.file_size)}</span>
                            <span>·</span>
                            <span>{new Date(att.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            {att.uploaded_by && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5">
                                  <User size={8} />
                                  {att.uploaded_by}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => lead && handleAttachDownload(lead.id, att)}
                            disabled={attachDownloading === att.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title={`Download ${att.filename}`}
                          >
                            {attachDownloading === att.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          </button>
                          {canDeleteAttachment(att) && (
                            <button
                              onClick={() => setAttachDeleteConfirm(att.id)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover/att:opacity-100"
                              title={`Delete ${att.filename}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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

      {/* ─── Footer CTAs ────────────────────────────────────────────────── */}
      {lead && !isLoading && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-200">
          {/* Left: Close */}
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X size={15} />
            Close
          </button>

          {/* Right: Edit + Delete */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(lead.id)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Edit2 size={15} />
                Edit Lead
              </button>
            )}

            {onDelete && canDelete && (
              <button
                onClick={() => onDelete(lead.id, `${lead.firstName} ${lead.lastName || ''}`.trim())}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
                title="Admin only — soft-deletes this lead"
              >
                <Trash2 size={15} />
                Delete Lead
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
