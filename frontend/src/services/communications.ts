/**
 * Communications Service
 * 
 * Handles sending emails and SMS to leads via the backend API.
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface SendEmailRequest {
  lead_id: string;
  category: string;
  subject: string;
  body: string;
}

export interface SendSMSRequest {
  lead_id?: string;
  to_phone?: string;
  category: string;
  message: string;
}

export interface CommunicationResponse {
  success: boolean;
  message: string;
  task_id?: string;
}

export interface CommunicationTemplate {
  id: string;
  label: string;
  description: string;
}

export interface TemplatesResponse {
  email_templates: CommunicationTemplate[];
  sms_templates: CommunicationTemplate[];
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Send an email to a lead
 */
export async function sendEmail(data: SendEmailRequest): Promise<CommunicationResponse> {
  try {
    const response = await apiClient.post<CommunicationResponse>('/api/communications/email/send', data);
    return response.data;
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      message: error.response?.data?.detail || 'Failed to send email. Please try again.',
    };
  }
}

/**
 * Send an SMS to a lead
 */
export async function sendSMS(data: SendSMSRequest): Promise<CommunicationResponse> {
  try {
    const response = await apiClient.post<CommunicationResponse>('/api/communications/sms/send', data);
    return response.data;
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      message: error.response?.data?.detail || 'Failed to send SMS. Please try again.',
    };
  }
}

/**
 * Get available communication templates
 */
export async function getTemplates(): Promise<TemplatesResponse | null> {
  try {
    const response = await apiClient.get<TemplatesResponse>('/api/communications/templates');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return null;
  }
}

export default {
  sendEmail,
  sendSMS,
  getTemplates,
};
