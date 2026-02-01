/**
 * EmailComposeDialog Component
 * 
 * Modal dialog for composing and sending emails to leads.
 * Features:
 * - Category dropdown with pre-defined templates
 * - Auto-populated subject based on category
 * - Rich text body with template variables
 * - Send button with loading state
 * 
 * @module components/dashboard/EmailComposeDialog
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Mail, Send, Loader2, CheckCircle, AlertCircle,
    FileText, Calendar, Phone, Clock, Heart
} from 'lucide-react';
import { sendEmail } from '../../services/communications';

// =============================================================================
// Types
// =============================================================================

interface Lead {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    leadId: string;
    condition?: string;
}

interface EmailComposeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    onSend?: (data: EmailSendData) => Promise<{ success: boolean; error?: string }>;
    /** Called after a successful email send — used to trigger cache refresh for queue movement */
    onSendSuccess?: () => void;
}

interface EmailSendData {
    lead_id: string;
    to_email: string;
    category: string;
    subject: string;
    body: string;
}

interface EmailTemplate {
    id: string;
    label: string;
    icon: React.ReactNode;
    subject: string;
    body: string;
}

// =============================================================================
// Email Templates
// =============================================================================

const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: 'follow_up',
        label: 'Follow-up',
        icon: <Clock size={16} />,
        subject: 'Following Up on Your TMS Therapy Inquiry',
        body: `Hi {{first_name}},

I hope this message finds you well. I wanted to follow up on your recent inquiry about TMS therapy.

We understand that taking the first step toward treatment can feel overwhelming, and we're here to support you every step of the way.

If you have any questions about TMS therapy or would like to schedule a consultation, please don't hesitate to reach out. You can reply to this email or call us at {{support_phone}}.

We look forward to hearing from you.

Warm regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'appointment_confirmation',
        label: 'Appointment Confirmation',
        icon: <Calendar size={16} />,
        subject: 'Your TMS Consultation Appointment is Confirmed',
        body: `Hi {{first_name}},

Great news! Your TMS therapy consultation has been confirmed.

**Appointment Details:**
- Date: [Please add date]
- Time: [Please add time]
- Location: TMS Center
  [Please add clinic address]

**What to Bring:**
- Photo ID
- Insurance card (if applicable)
- List of current medications
- Any relevant medical records

**What to Expect:**
Your consultation will take approximately 45-60 minutes. Our specialist will review your medical history, explain the TMS treatment process, and answer any questions you may have.

If you need to reschedule, please call us at {{support_phone}} at least 24 hours in advance.

We look forward to meeting you!

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'appointment_reminder',
        label: 'Appointment Reminder',
        icon: <Calendar size={16} />,
        subject: 'Reminder: Your TMS Consultation Tomorrow',
        body: `Hi {{first_name}},

This is a friendly reminder about your upcoming TMS therapy consultation.

**Appointment Details:**
- Date: Tomorrow
- Time: [Please add time]
- Location: TMS Center
  [Please add clinic address]

**Don't forget to bring:**
- Photo ID
- Insurance card
- List of current medications

If you need to reschedule, please call us at {{support_phone}} as soon as possible.

See you soon!

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'missed_call',
        label: 'Missed Call Follow-up',
        icon: <Phone size={16} />,
        subject: 'We Tried to Reach You About Your TMS Inquiry',
        body: `Hi {{first_name}},

We tried calling you today but weren't able to connect. We wanted to follow up on your inquiry about TMS therapy.

We understand you're busy, so please feel free to:
- Reply to this email with a convenient time to call
- Call us directly at {{support_phone}}
- Schedule online at our website

We're here to answer any questions you may have about TMS therapy and how it might help you.

Looking forward to speaking with you soon.

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'thank_you',
        label: 'Thank You',
        icon: <Heart size={16} />,
        subject: 'Thank You for Speaking with Us About TMS Therapy',
        body: `Hi {{first_name}},

Thank you for taking the time to speak with us today about TMS therapy. We truly appreciate your trust in our care team.

As discussed, TMS (Transcranial Magnetic Stimulation) is an FDA-approved, non-invasive treatment that has helped many patients find relief from depression and other conditions.

**Next Steps:**
[Please add any specific next steps discussed]

If you have any additional questions or would like to move forward with treatment, please don't hesitate to reach out.

We're here to support you on your journey to better mental health.

Warm regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'no_response_final',
        label: 'Final Outreach',
        icon: <AlertCircle size={16} />,
        subject: 'Final Outreach From Our TMS Care Team',
        body: `Hi {{first_name}},

We've tried reaching out a few times regarding your interest in TMS therapy, and we wanted to check in one more time.

We understand that life gets busy and priorities change. If you're still interested in learning about TMS therapy, we'd love to hear from you.

If now isn't the right time, that's completely okay. Please know that our doors are always open whenever you're ready to explore treatment options.

You can reach us at {{support_phone}} or simply reply to this email.

Wishing you all the best,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'custom',
        label: 'Custom Email',
        icon: <FileText size={16} />,
        subject: '',
        body: `Hi {{first_name}},

[Your message here]

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
];

// =============================================================================
// Component
// =============================================================================

export const EmailComposeDialog: React.FC<EmailComposeDialogProps> = ({
    isOpen,
    onClose,
    lead,
    onSend: _onSend,
    onSendSuccess,
}) => {
    // _onSend is available for custom send handler override (currently uses built-in sendEmail)
    void _onSend;
    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------

    const [selectedCategory, setSelectedCategory] = useState<string>('follow_up');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    // ---------------------------------------------------------------------------
    // Effects
    // ---------------------------------------------------------------------------

    // Reset form when dialog opens or lead changes
    useEffect(() => {
        if (isOpen && lead) {
            setSelectedCategory('follow_up');
            const template = EMAIL_TEMPLATES.find(t => t.id === 'follow_up');
            if (template) {
                setSubject(replaceVariables(template.subject, lead));
                setBody(replaceVariables(template.body, lead));
            }
            setSendResult(null);
        }
    }, [isOpen, lead]);

    // Update subject and body when category changes
    useEffect(() => {
        if (lead) {
            const template = EMAIL_TEMPLATES.find(t => t.id === selectedCategory);
            if (template) {
                setSubject(replaceVariables(template.subject, lead));
                setBody(replaceVariables(template.body, lead));
            }
        }
    }, [selectedCategory, lead]);

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const replaceVariables = useCallback((text: string, leadData: Lead): string => {
        return text
            .replace(/\{\{first_name\}\}/g, leadData.firstName || 'there')
            .replace(/\{\{last_name\}\}/g, leadData.lastName || '')
            .replace(/\{\{lead_number\}\}/g, leadData.leadId || '')
            .replace(/\{\{support_phone\}\}/g, '(480) 668-3599')
            .replace(/\{\{clinic_name\}\}/g, 'TMS Institute of Arizona');
    }, []);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleSend = async () => {
        if (!lead || !subject.trim() || !body.trim()) {
            setSendResult({ success: false, message: 'Please fill in all fields' });
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            // Use the communications service to send email via backend
            const result = await sendEmail({
                lead_id: lead.id,
                category: selectedCategory,
                subject: subject.trim(),
                body: body.trim(),
            });

            if (result.success) {
                const recipientName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'recipient';
                setSendResult({
                    success: true,
                    message: `Email sent successfully to ${recipientName}.`,
                });
                setIsSending(false);
                // Defer onSendSuccess and close until after user sees confirmation
                setTimeout(() => {
                    onSendSuccess?.();
                    onClose();
                }, 2000);
                return;
            } else {
                setSendResult({ success: false, message: result.message || 'Failed to send email. Please try again.' });
            }
        } catch (error) {
            setSendResult({ success: false, message: 'Network error. Please try again.' });
        } finally {
            setIsSending(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (!isOpen || !lead) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Mail size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Compose Email</h3>
                            <p className="text-sm text-gray-500">
                                To: {lead.firstName} {lead.lastName} &lt;{lead.email}&gt;
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Category Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Template
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {EMAIL_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => setSelectedCategory(template.id)}
                                    className={`
                    flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
                    border transition-all duration-200
                    ${selectedCategory === template.id
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                  `}
                                >
                                    {template.icon}
                                    <span className="truncate">{template.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject..."
                            className="
                w-full px-4 py-2.5 text-sm
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Message
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Type your message..."
                            rows={12}
                            className="
                w-full px-4 py-3 text-sm font-mono
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                resize-none
              "
                        />
                    </div>

                    {/* Result Message */}
                    {sendResult && (
                        <div className={`
              flex items-center gap-2 px-4 py-3 rounded-lg
              ${sendResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
            `}>
                            {sendResult.success ? (
                                <CheckCircle size={18} />
                            ) : (
                                <AlertCircle size={18} />
                            )}
                            <span className="text-sm font-medium">{sendResult.message}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500">
                        Reference: {lead.leadId}
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            disabled={isSending}
                            className="
                px-4 py-2 text-sm font-medium
                text-gray-700 bg-white border border-gray-300 rounded-lg
                hover:bg-gray-50 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !subject.trim() || !body.trim()}
                            className="
                flex items-center gap-2 px-4 py-2 text-sm font-medium
                text-white bg-blue-600 rounded-lg
                hover:bg-blue-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
                        >
                            {isSending ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Send Email
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailComposeDialog;
