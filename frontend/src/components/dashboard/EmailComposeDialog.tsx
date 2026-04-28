/**
 * EmailComposeDialog Component
 * 
 * Modal dialog for composing and sending emails to leads.
 * Features:
 * - Compact chip-based template selection
 * - Auto-populated subject based on category
 * - Editable body with template variables
 * - Send button with loading state
 * 
 * @module components/dashboard/EmailComposeDialog
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Mail, Send, Loader2, CheckCircle, AlertCircle,
    Sparkles
} from 'lucide-react';
import { sendEmail } from '../../services/communications';
import { getAIEmailDraft } from '../../services/aiInsights';

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
        id: 'day_3_education',
        label: 'Day 3 — Educational',
        subject: 'A Quick TMS Resource for You',
        body: `Hi {{first_name}},

I wanted to share a quick follow-up on TMS therapy in case you're still exploring options.

TMS is non-invasive, does not require anesthesia, and is commonly used when symptoms have not improved enough with medication or therapy alone.

If it would help, we can walk through eligibility, insurance, and what treatment looks like in a short call. You can reply here or call {{support_phone}}.

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'day_7_why_us',
        label: 'Day 7 — Why Patients Choose Us',
        subject: 'Why Patients Choose TMS Institute of Arizona',
        body: `Hi {{first_name}},

I know choosing a treatment provider is personal. Patients often choose us because we take time to verify coverage, explain the treatment process clearly, and help them understand whether TMS is a good fit before moving forward.

If you're still considering TMS therapy, I'd be happy to answer questions and help you decide on next steps without pressure.

You can reply to this email or call {{support_phone}}.

Warm regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'day_14_reengagement',
        label: 'Day 14 — Re-engagement',
        subject: "No Pressure — We're Here When You're Ready",
        body: `Hi {{first_name}},

I completely understand if now is not the right time to pursue treatment. I just wanted to check in one more time and make sure you have a clear path back to us if TMS therapy is still something you want to explore.

If questions come up later, you can reply here or call {{support_phone}}. There's no pressure from us.

Wishing you well,
TMS Institute of Arizona
{{support_phone}}`,
    },
    {
        id: 'no_response_final',
        label: 'Final Outreach',
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
        subject: '',
        body: `Hi {{first_name}},

[Your message here]

Best regards,
TMS Institute of Arizona
{{support_phone}}`,
    },
];

const TEMPLATE_CHIP_ORDER = [
    'follow_up',
    'appointment_confirmation',
    'appointment_reminder',
    'missed_call',
    'thank_you',
    'day_3_education',
    'day_7_why_us',
    'day_14_reengagement',
    'no_response_final',
    'custom',
] as const;

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
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    // Queue context used for the AI chip tooltip so coordinators can inspect
    // why the draft was selected without adding visual weight to the modal.
    const [aiQueueContext, setAiQueueContext] = useState<{
        status?: string | null;
        contact_outcome?: string | null;
        priority?: string | null;
        follow_up_reason?: string | null;
    } | null>(null);
    const aiRequestRef = useRef(0);
    const prevIsOpenRef = useRef(false);
    const leadRef = useRef(lead);
    leadRef.current = lead;

    const replaceVariables = useCallback((text: string, leadData: Lead): string => {
        return text
            .replace(/\{\{first_name\}\}/g, leadData.firstName || 'there')
            .replace(/\{\{last_name\}\}/g, leadData.lastName || '')
            .replace(/\{\{lead_number\}\}/g, leadData.leadId || '')
            .replace(/\{\{support_phone\}\}/g, '(480) 668-3599')
            .replace(/\{\{clinic_name\}\}/g, 'TMS Institute of Arizona');
    }, []);

    const handleAIRecommended = useCallback(async () => {
        if (!lead) return;
        const requestId = aiRequestRef.current + 1;
        aiRequestRef.current = requestId;
        setAiLoading(true);
        setAiError(null);
        try {
            const draft = await getAIEmailDraft(lead.id);
            if (requestId !== aiRequestRef.current || leadRef.current?.id !== lead.id) {
                return;
            }
            setSelectedCategory('ai_recommended');
            setSubject(draft.subject);
            setBody(draft.body);
            setAiQueueContext(draft.queue_context || null);
        } catch (err) {
            if (requestId !== aiRequestRef.current) {
                return;
            }
            // Strict-AI policy: there is no silent template fallback. We show
            // the real backend error so the user knows whether to retry or ask
            // an admin to configure the AI provider key.
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            setAiError(
                axiosErr?.response?.data?.detail
                    || (err instanceof Error ? err.message : 'Could not generate AI email draft.'),
            );
            setAiQueueContext(null);
        } finally {
            if (requestId === aiRequestRef.current) {
                setAiLoading(false);
            }
        }
    }, [lead]);

    // ---------------------------------------------------------------------------
    // Effects
    // ---------------------------------------------------------------------------

    // Reset form ONLY when dialog transitions from closed → open.
    // This prevents resetting the form when the parent re-renders and
    // passes a new lead object reference (same data, different reference).
    useEffect(() => {
        const justOpened = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;

        if (justOpened && lead) {
            setSelectedCategory('follow_up');
            const template = EMAIL_TEMPLATES.find(t => t.id === 'follow_up');
            if (template) {
                setSubject(replaceVariables(template.subject, lead));
                setBody(replaceVariables(template.body, lead));
            }
            setSendResult(null);
            setAiQueueContext(null);
            void handleAIRecommended();
        }
    }, [isOpen, lead, replaceVariables, handleAIRecommended]);

    // Update subject and body ONLY when the coordinator explicitly changes the template category.
    // The lead ref is used so this effect doesn't re-run on lead reference changes.
    useEffect(() => {
        const currentLead = leadRef.current;
        if (currentLead) {
            const template = EMAIL_TEMPLATES.find(t => t.id === selectedCategory);
            if (template) {
                setSubject(replaceVariables(template.subject, currentLead));
                setBody(replaceVariables(template.body, currentLead));
            }
        }
    }, [selectedCategory, replaceVariables]);

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
                // Check if queued (async via Celery) vs sent directly
                const isQueued = result.message?.toLowerCase().includes('queued');
                setSendResult({
                    success: true,
                    message: isQueued
                        ? `Email queued for delivery to ${recipientName}. It will be sent shortly.`
                        : `Email sent successfully to ${recipientName}.`,
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
    const aiContextSummary = [
        aiQueueContext?.priority ? `${aiQueueContext.priority.toLowerCase()} priority` : null,
        aiQueueContext?.status ? aiQueueContext.status.replace(/_/g, ' ').toLowerCase() : null,
        aiQueueContext?.contact_outcome ? aiQueueContext.contact_outcome.replace(/_/g, ' ').toLowerCase() : null,
    ].filter(Boolean).join(' - ');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/[0.04] p-3">
            <div className="w-full max-w-[512px] max-h-[92vh] overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl ring-1 ring-gray-200 flex flex-col">
                <div className="flex items-start justify-between px-6 pt-6 pb-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Mail size={20} className="text-blue-600" />
                            <h3 className="text-lg font-bold text-gray-900">Send Email</h3>
                        </div>
                        <p className="mt-4 text-sm text-gray-500 truncate">
                            To: {lead.firstName} {lead.lastName} &lt;{lead.email}&gt;
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close email dialog"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto premium-scrollbar px-6 pb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                        Templates
                    </p>
                    <div className="mb-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleAIRecommended}
                            disabled={aiLoading}
                            title={aiContextSummary || 'Generate the recommended draft from lead context'}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                selectedCategory === 'ai_recommended' && !aiError
                                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700'
                            } ${aiLoading ? 'cursor-wait opacity-75' : ''}`}
                        >
                            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            AI Recommended
                        </button>
                        {TEMPLATE_CHIP_ORDER.map((id) => {
                            const template = EMAIL_TEMPLATES.find(t => t.id === id);
                            if (!template) return null;
                            const selected = selectedCategory === template.id;
                            return (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => {
                                        aiRequestRef.current += 1;
                                        setAiLoading(false);
                                        setSelectedCategory(template.id);
                                        setAiError(null);
                                    }}
                                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                        selected
                                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                    }`}
                                >
                                    {template.label}
                                </button>
                            );
                        })}
                    </div>

                    {aiError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <AlertCircle size={12} /> AI draft unavailable
                            </div>
                            <p className="mt-1 text-red-700">{aiError}</p>
                            <p className="mt-1 text-red-600">
                                Pick a manual template to send, or click <span className="font-semibold">AI Recommended</span> to retry.
                            </p>
                        </div>
                    )}

                    {/* Subject */}
                    <div>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject..."
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="mt-3">
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Type your message..."
                            rows={8}
                            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Templates are editable before sending.
                    </p>

                    {sendResult && (
                        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            sendResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                            {sendResult.success ? (
                                <CheckCircle size={16} />
                            ) : (
                                <AlertCircle size={16} />
                            )}
                            <span className="font-medium">{sendResult.message}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-6 pt-2 pb-6">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !subject.trim() || !body.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    );
};

export default EmailComposeDialog;
