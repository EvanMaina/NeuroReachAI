/**
 * Calls Service
 * 
 * 3CX handles ALL phone calls (inbound and outbound).
 * The coordinator dashboard uses tel: links which the 3CX Chrome extension
 * intercepts to initiate calls. No Twilio Voice is used.
 * 
 * Service architecture:
 * - 3CX: All phone calls (inbound + outbound) — already configured and working
 * - Twilio: SMS only (see sms_service.py)
 * - Paubox: Email only (see email_service.py)
 * - CallRail: Call tracking and analytics only (see callrail.ts)
 * 
 * @module services/calls
 * @version 2.0.0
 */

// =============================================================================
// 3CX Click-to-Call
// =============================================================================

/**
 * Initiate a call via 3CX using a tel: link.
 * 
 * The 3CX Chrome extension intercepts tel: links and initiates the call
 * through the coordinator's 3CX softphone. No server-side API needed.
 * 
 * @param phoneNumber - The phone number to call
 */
export function initiateCall3CX(phoneNumber: string): void {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const telUri = cleaned.startsWith('+') ? `tel:${cleaned}` : `tel:+1${cleaned}`;
  window.location.href = telUri;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format phone number for display
 * 
 * @param phone - Raw phone number
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length >= 12) {
    // International format
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
  }
  
  return phone;
}
