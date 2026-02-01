/**
 * Schedule Modal Component
 * 
 * Modal for scheduling callbacks with leads.
 * Includes date/time picker, contact method selector, and notes field.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Calendar, Clock, Phone, Mail, MessageSquare, Video,
  User, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { scheduleCallback, type ContactMethod, type IScheduleCallbackRequest, type ScheduleType } from '../../services/leads';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadCondition?: string;
  leadPriority?: 'hot' | 'medium' | 'low';
  scheduleType?: 'callback' | 'consultation';
  onScheduleSuccess?: () => void;
}

const contactMethods: { value: ContactMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'PHONE', label: 'Phone Call', icon: <Phone size={18} /> },
  { value: 'EMAIL', label: 'Email', icon: <Mail size={18} /> },
  { value: 'SMS', label: 'SMS/Text', icon: <MessageSquare size={18} /> },
  { value: 'VIDEO_CALL', label: 'Video Call', icon: <Video size={18} /> },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  leadId,
  leadName,
  leadCondition,
  leadPriority = 'medium',
  scheduleType = 'callback',
  onScheduleSuccess,
}) => {
  // Dynamic labels based on schedule type
  const typeLabel = scheduleType === 'consultation' ? 'Consultation' : 'Callback';
  const titleText = `Schedule ${typeLabel}`;
  const buttonText = `Schedule ${typeLabel}`;
  const successText = `${typeLabel} Scheduled!`;
  // Form state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('PHONE');
  const [notes, setNotes] = useState<string>('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set default date to today
      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
      
      // Set default time to next hour
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setSelectedTime(nextHour.toTimeString().slice(0, 5));
      
      setContactMethod('PHONE');
      setNotes('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Get minimum date (today)
  const getMinDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Get maximum date (3 months from now)
  const getMaxDate = (): string => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!selectedDate || !selectedTime) {
      setError('Please select both date and time');
      return;
    }

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    
    if (scheduledDateTime < new Date()) {
      setError('Cannot schedule in the past');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const scheduleData: IScheduleCallbackRequest = {
        scheduled_callback_at: scheduledDateTime.toISOString(),
        contact_method: contactMethod,
        scheduled_notes: notes.trim() || undefined,
        // CRITICAL: Pass schedule_type to differentiate callback vs consultation routing
        schedule_type: scheduleType as ScheduleType,
      };

      await scheduleCallback(leadId, scheduleData);
      
      setSuccess(true);
      
      // Close modal after showing success
      setTimeout(() => {
        onClose();
        if (onScheduleSuccess) {
          onScheduleSuccess();
        }
      }, 1500);
    } catch (err) {
      console.error('Error scheduling callback:', err);
      setError('Failed to schedule callback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, contactMethod, notes, leadId, onClose, onScheduleSuccess]);

  // Priority badge styling
  const getPriorityStyles = (priority: string): string => {
    switch (priority) {
      case 'hot':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  // Format time for display
  const formatScheduledTime = (): string => {
    if (!selectedDate || !selectedTime) return '';
    
    const date = new Date(`${selectedDate}T${selectedTime}`);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      size="md"
    >
      {/* Success State */}
      {success ? (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {successText}
          </h3>
          <p className="text-gray-500">
            {formatScheduledTime()}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lead Info Card */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{leadName}</span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full border font-medium
                    ${getPriorityStyles(leadPriority)}
                  `}>
                    {leadPriority.toUpperCase()}
                  </span>
                </div>
                {leadCondition && (
                  <p className="text-sm text-gray-500">{leadCondition}</p>
                )}
              </div>
            </div>
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>

            {/* Time Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} className="inline mr-1" />
                Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* Contact Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {contactMethods.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setContactMethod(method.value)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${contactMethod === method.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }
                  `}
                >
                  {method.icon}
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Summary */}
          {selectedDate && selectedTime && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Scheduled for:</strong> {formatScheduledTime()}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Contact via: {contactMethods.find(m => m.value === contactMethod)?.label}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar size={18} />
                  {buttonText}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ScheduleModal;
