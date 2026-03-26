/**
 * Lead Attachments API Service
 *
 * Handles file upload, download, list, delete, and bulk attachment counts
 * for the lead attachment system.
 *
 * Backend endpoints live under /api/leads/ (attachments router).
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

/** Single attachment metadata returned by the backend */
export interface IAttachment {
    id: string;
    lead_id: string;
    filename: string;
    stored_filename: string;
    file_type: string;
    file_size: number;
    uploaded_by: string;
    uploaded_by_id: string | null;
    created_at: string;
}

/** Map of lead_id -> attachment count (for table paperclip badge) */
export type AttachmentCountMap = Record<string, number>;

/** Global event fired whenever a lead's attachments change. */
export const ATTACHMENTS_CHANGED_EVENT = 'neuroreach:attachments-changed';

// =============================================================================
// Helper — human-readable file size
// =============================================================================

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function notifyAttachmentsChanged(leadId: string): void {
    window.dispatchEvent(
        new CustomEvent(ATTACHMENTS_CHANGED_EVENT, {
            detail: { leadId },
        }),
    );
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Upload a file attachment to a lead.
 *
 * @param leadId  UUID of the lead
 * @param file    File object from input or drag-and-drop
 * @returns       The created attachment metadata
 */
export async function uploadAttachment(
    leadId: string,
    file: File,
): Promise<IAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    // IMPORTANT: Do NOT set Content-Type manually for FormData.
    // Axios/browser must auto-set it with the correct multipart boundary.
    // Manually setting 'Content-Type: multipart/form-data' omits the
    // boundary parameter, causing the server to hang or return 422.
    const response = await apiClient.post<IAttachment>(
        `/api/leads/${leadId}/attachments`,
        formData,
        {
            headers: { 'Content-Type': undefined as unknown as string },
            timeout: 60000, // 60s timeout for large file uploads
        },
    );
    return response.data;
}

/**
 * List all attachments for a lead (newest first).
 */
export async function listAttachments(leadId: string): Promise<IAttachment[]> {
    const response = await apiClient.get<IAttachment[]>(
        `/api/leads/${leadId}/attachments`,
    );
    return response.data;
}

/**
 * Download an attachment.  Returns the download URL so the browser can
 * handle the actual download (opens in new tab / triggers Save-As).
 */
export function getAttachmentDownloadUrl(
    leadId: string,
    attachmentId: string,
): string {
    // Build absolute URL using the API base
    const base = apiClient.defaults.baseURL || '';
    return `${base}/api/leads/${leadId}/attachments/${attachmentId}/download`;
}

/**
 * Trigger a browser download for an attachment by fetching as blob.
 */
export async function downloadAttachment(
    leadId: string,
    attachmentId: string,
    filename: string,
): Promise<void> {
    const response = await apiClient.get(
        `/api/leads/${leadId}/attachments/${attachmentId}/download`,
        { responseType: 'blob' },
    );

    // Create a temporary link and click it to trigger the download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

/**
 * Delete an attachment (file + metadata).
 */
export async function deleteAttachment(
    leadId: string,
    attachmentId: string,
): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
        `/api/leads/${leadId}/attachments/${attachmentId}`,
    );
    return response.data;
}

/**
 * Get attachment counts for all leads that have at least one attachment.
 * Used by LeadsTable to show/hide the paperclip icon in the Actions column.
 *
 * Returns a map: { "lead-uuid-1": 3, "lead-uuid-2": 1, ... }
 */
export async function getAttachmentCounts(): Promise<AttachmentCountMap> {
    const response = await apiClient.get<AttachmentCountMap>(
        '/api/leads/attachment-counts',
    );
    return response.data;
}
