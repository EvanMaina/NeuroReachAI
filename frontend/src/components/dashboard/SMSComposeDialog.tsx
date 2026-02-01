/**
 * SMSComposeDialog Component
 * 
 * Modal dialog for composing and sending SMS messages to leads.
 * Features:
 * - Category dropdown with pre-defined templates
 * - Character counter (160 chars per segment)
 * - Template preview with variables replaced
 * - Send button with loading state
 * 
 * @module components/dashboard/SMSComposeDialog
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    X, MessageSquare, Send, Loader2, CheckCircle, AlertCircle,
    Clock, Calendar, Phone, Heart, AlertTriangle
} from 'lucide-react';
import { sendSMS } from '../../services/communications';

// =============================================================================
// Types
// =============================================================================

interface Lead {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone: string;
    leadId: string;
    condition?: string;
}

interface SMSComposeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    onSend?: (data: SMSSendData) => Promise<{ success: boolean; error?: string }>;
    /** For general SMS mode without a lead */
    generalMode?: boolean;
    /** Called after a successful SMS send — used to trigger cache refresh for queue movement */
    onSendSuccess?: () => void;
}

interface SMSSendData {
    lead_id: string;
    to_phone: string;
    category: string;
    message: string;
}

interface SMSTemplate {
    id: string;
    label: string;
    icon: React.ReactNode;
    message: string;
}

// =============================================================================
// SMS Templates (160 char limit per segment)
// =============================================================================

const SMS_TEMPLATES: SMSTemplate[] = [
    {
        id: 'follow_up',
        label: 'Follow-up',
        icon: <Clock size={16} />,
        message: `Hi {{first_name}}, this is TMS Institute of Arizona following up on your inquiry. We'd love to answer any questions about TMS therapy. Call us at {{support_phone}} or reply to schedule.`,
    },
    {
        id: 'appointment_reminder',
        label: 'Appointment Reminder',
        icon: <Calendar size={16} />,
        message: `Hi {{first_name}}, reminder: Your TMS consultation is tomorrow. Reply C to confirm or R to reschedule. Questions? Call {{support_phone}}. - TMS Institute of Arizona`,
    },
    {
        id: 'missed_call',
        label: 'Missed Call',
        icon: <Phone size={16} />,
        message: `Hi {{first_name}}, we tried calling but couldn't reach you. Please call us back at {{support_phone}} when you have a moment. - TMS Institute of Arizona`,
    },
    {
        id: 'thank_you',
        label: 'Thank You',
        icon: <Heart size={16} />,
        message: `Hi {{first_name}}, thank you for speaking with us today! If you have any questions about TMS therapy, don't hesitate to reach out. - TMS Institute of Arizona`,
    },
    {
        id: 'schedule_request',
        label: 'Schedule Request',
        icon: <Calendar size={16} />,
        message: `Hi {{first_name}}, we'd like to schedule your TMS consultation. What times work best for you this week? Reply or call {{support_phone}}. - TMS Institute of Arizona`,
    },
    {
        id: 'no_response_final',
        label: 'Final Outreach',
        icon: <AlertTriangle size={16} />,
        message: `Hi {{first_name}}, we've been trying to reach you about TMS therapy. If you're still interested, please call {{support_phone}}. We're here when you're ready. - TMS Institute of Arizona`,
    },
    {
        id: 'custom',
        label: 'Custom SMS',
        icon: <MessageSquare size={16} />,
        message: `Hi {{first_name}}, [Your message here] - TMS Institute of Arizona {{support_phone}}`,
    },
];

// =============================================================================
// Component
// =============================================================================

export const SMSComposeDialog: React.FC<SMSComposeDialogProps> = ({
    isOpen,
    onClose,
    lead,
    onSend: _onSend,
    generalMode = false,
    onSendSuccess,
}) => {
    // _onSend is available for custom send handler override (currently uses built-in sendSMS)
    void _onSend;
    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------

    const [selectedCategory, setSelectedCategory] = useState<string>('follow_up');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const [editablePhone, setEditablePhone] = useState('');

    // ---------------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------------

    const SMS_SEGMENT_LENGTH = 160;
    const MAX_SEGMENTS = 3;
    const MAX_LENGTH = SMS_SEGMENT_LENGTH * MAX_SEGMENTS;

    // ---------------------------------------------------------------------------
    // Effects
    // ---------------------------------------------------------------------------

    // Reset form when dialog opens or lead changes
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory(lead ? 'follow_up' : 'custom');
            setSendResult(null);
            setEditablePhone(lead?.phone || '');
            
            if (lead) {
                const template = SMS_TEMPLATES.find(t => t.id === 'follow_up');
                if (template) {
                    setMessage(replaceVariables(template.message, lead));
                }
            } else {
                // General mode - empty message
                setMessage('');
            }
        }
    }, [isOpen, lead]);

    // Update message when category changes
    useEffect(() => {
        if (lead) {
            const template = SMS_TEMPLATES.find(t => t.id === selectedCategory);
            if (template) {
                setMessage(replaceVariables(template.message, lead));
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

    const getSegmentCount = useCallback((text: string): number => {
        if (!text) return 0;
        return Math.ceil(text.length / SMS_SEGMENT_LENGTH);
    }, []);

    const getCharacterInfo = useCallback((text: string): { current: number; remaining: number; segments: number } => {
        const current = text.length;
        const segments = getSegmentCount(text);
        const nextSegmentThreshold = segments * SMS_SEGMENT_LENGTH;
        const remaining = nextSegmentThreshold - current;
        return { current, remaining, segments };
    }, [getSegmentCount]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleSend = async () => {
        const phoneToSend = editablePhone.trim();
        
        if (!phoneToSend) {
            setSendResult({ success: false, message: 'Please enter a phone number' });
            return;
        }
        
        if (!message.trim()) {
            setSendResult({ success: false, message: 'Please enter a message' });
            return;
        }

        if (message.length > MAX_LENGTH) {
            setSendResult({ success: false, message: `Message too long. Maximum ${MAX_LENGTH} characters.` });
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            // Use the communications service to send SMS via backend
            const result = await sendSMS({
                lead_id: lead?.id,
                to_phone: phoneToSend,
                category: selectedCategory,
                message: message.trim(),
            });

            if (result.success) {
                const recipientName = lead
                    ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'recipient'
                    : phoneToSend;
                setSendResult({
                    success: true,
                    message: `SMS sent successfully to ${recipientName}.`,
                });
                setIsSending(false);
                // Defer onSendSuccess and close until after user sees confirmation
                setTimeout(() => {
                    onSendSuccess?.();
                    onClose();
                }, 2000);
                return;
            } else {
                setSendResult({ success: false, message: result.message || 'Failed to send SMS. Please try again.' });
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

    if (!isOpen || (!lead && !generalMode)) return null;

    const charInfo = getCharacterInfo(message);
    const isOverLimit = message.length > MAX_LENGTH;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <MessageSquare size={20} className="text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {generalMode && !lead ? 'Quick SMS' : 'Compose SMS'}
                            </h3>
                            {lead ? (
                                <p className="text-sm text-gray-500">
                                    To: {lead.firstName} {lead.lastName}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Send a message to any number
                                </p>
                            )}
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
                    {/* Editable Phone Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Recipient Phone Number
                        </label>
                        <input
                            type="tel"
                            value={editablePhone}
                            onChange={(e) => setEditablePhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="w-full px-4 py-2.5 text-sm font-mono border border-gray-300 rounded-lg 
                                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            You can edit this number before sending
                        </p>
                    </div>

                    {/* Category Selector - Only show for lead mode */}
                    {lead && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            SMS Template
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {SMS_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => setSelectedCategory(template.id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
                                        border transition-all duration-200
                                        ${selectedCategory === template.id
                                            ? 'bg-green-50 border-green-300 text-green-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                                    `}
                                >
                                    {template.icon}
                                    <span className="truncate">{template.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Message */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Message
                            </label>
                            <div className={`text-xs font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
                                {charInfo.current}/{MAX_LENGTH} chars • {charInfo.segments} segment{charInfo.segments !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message..."
                            rows={5}
                            maxLength={MAX_LENGTH + 50} // Allow slight overflow to show warning
                            className={`
                                w-full px-4 py-3 text-sm
                                border rounded-lg
                                focus:outline-none focus:ring-2 focus:border-transparent
                                resize-none
                                ${isOverLimit
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-gray-300 focus:ring-green-500'}
                            `}
                        />

                        {/* Character Progress Bar */}
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${charInfo.segments === 1 ? 'bg-green-500' :
                                    charInfo.segments === 2 ? 'bg-amber-500' :
                                        isOverLimit ? 'bg-red-500' : 'bg-orange-500'
                                    }`}
                                style={{ width: `${Math.min((charInfo.current / MAX_LENGTH) * 100, 100)}%` }}
                            />
                        </div>

                        {/* Segment Info */}
                        <p className="text-xs text-gray-500 mt-2">
                            {charInfo.segments === 1 && 'Single SMS segment'}
                            {charInfo.segments === 2 && 'Note: 2 SMS segments (may incur additional charges)'}
                            {charInfo.segments >= 3 && !isOverLimit && 'Note: 3 SMS segments (maximum)'}
                            {isOverLimit && 'Message too long - please shorten'}
                        </p>
                    </div>

                    {/* SMS Consent Warning */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            Only send SMS to leads who have provided SMS consent.
                            Ensure compliance with TCPA regulations.
                        </p>
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
                        {lead ? `Reference: ${lead.leadId}` : 'Quick SMS'}
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
                            disabled={isSending || !message.trim() || isOverLimit}
                            className="
                                flex items-center gap-2 px-4 py-2 text-sm font-medium
                                text-white bg-green-600 rounded-lg
                                hover:bg-green-700 transition-colors
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
                                    Send SMS
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SMSComposeDialog;
