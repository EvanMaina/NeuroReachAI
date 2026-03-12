/**
 * useNotifications Hook
 * 
 * Real-time notification system for new hot leads.
 * Uses browser Notification API + audio alerts.
 */

import { useState, useCallback, useRef } from 'react';
import type { LeadTableRow } from '../types/lead';
import { playNotificationChime } from '../utils/notificationSound';
import { showToast } from '../components/common/ToastContainer';

// ---------------------------------------------------------------------------
// Module-level singleton — ONE shared set across ALL hook instances
// ---------------------------------------------------------------------------
// Problem being solved: React StrictMode + concurrent rendering can mount
// multiple instances of useNotifications at the same time.  When each
// instance keeps its own previousLeadsRef, they all "see" the same lead
// as new → duplicate chimes and duplicate toasts.
//
// Fix: promote previousLeadsRef to module scope so it is truly shared.
// ---------------------------------------------------------------------------
let _prevLeadIds = new Set<string>();
let _prevLeadIdsInitialised = false;          // becomes true after first poll
// ---------------------------------------------------------------------------


interface NotificationState {
  permission: NotificationPermission;
  enabled: boolean;
  soundEnabled: boolean;
  unreadCount: number;
}

interface HotLeadNotification {
  id: string;
  leadId: string;
  name: string;
  condition: string;
  timestamp: Date;
  read: boolean;
}

export const useNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    permission: 'default',
    enabled: false,
    soundEnabled: true,
    unreadCount: 0,
  });
  
  const [notifications, setNotifications] = useState<HotLeadNotification[]>([]);
  // previousLeadsRef kept as instance ref solely for the unsubscribe/cleanup
  // path — the canonical previous-set used for de-dup is _prevLeadIds above.
  const previousLeadsRef = useRef<Set<string>>(_prevLeadIds);


  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({
        ...prev,
        permission,
        enabled: permission === 'granted',
      }));
      return permission === 'granted';
    } catch (_error) {
      return false;
    }
  }, []);

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (state.permission !== 'granted') {
      await requestPermission();
    }
    setState(prev => ({ ...prev, enabled: !prev.enabled }));
  }, [state.permission, requestPermission]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  // Play notification sound using Web Audio chime
  const playSound = useCallback(() => {
    if (state.soundEnabled) {
      playNotificationChime(0.35);
    }
  }, [state.soundEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback((lead: LeadTableRow) => {
    if (state.enabled && state.permission === 'granted') {
      const notification = new Notification('🔥 New Hot Lead!', {
        body: `${lead.firstName} ${lead.lastName} - ${lead.condition}`,
        icon: '/favicon.ico',
        tag: lead.id,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    }
  }, [state.enabled, state.permission]);

  // Check for new hot leads
  const checkNewHotLeads = useCallback((leads: LeadTableRow[]) => {
    const currentLeadIds = new Set(leads.map(l => l.id));
    const hotLeads = leads.filter(l => l.priority === 'hot' && l.status === 'new');

    // Find new hot leads that:
    //   1. Were NOT seen in the previous poll cycle (truly new)
    //   2. Are NOT manual leads — coordinator-added leads must never trigger
    //      a notification, because the coordinator themselves just created them.
    const newHotLeads = hotLeads.filter(lead =>
      lead.source !== 'manual' && !_prevLeadIds.has(lead.id)
    );

    if (newHotLeads.length > 0 && _prevLeadIdsInitialised) {

      // We have new hot leads!
      newHotLeads.forEach(lead => {
        // Show browser notification
        showBrowserNotification(lead);

        // Add to notification list
        setNotifications(prev => [{
          id: `notif-${lead.id}-${Date.now()}`,
          leadId: lead.id,
          name: `${lead.firstName} ${lead.lastName}`,
          condition: lead.condition,
          timestamp: new Date(),
          read: false,
        }, ...prev].slice(0, 50)); // Keep last 50

        // Update unread count
        setState(prev => ({
          ...prev,
          unreadCount: prev.unreadCount + 1,
        }));
      });

      // Play sound once for all new leads
      playSound();

      // Dispatch app-shell toast for visibility on ALL pages
      if (newHotLeads.length === 1) {
        const lead = newHotLeads[0];
        showToast('new-lead', '🔥 New Hot Lead', `${lead.firstName} ${lead.lastName} — ${lead.condition}`);
      } else {
        showToast('new-lead', '🔥 New Hot Leads', `${newHotLeads.length} new hot leads just arrived`);
      }
    }

    // Update the module-level singleton and the instance ref together
    _prevLeadIds = currentLeadIds;
    previousLeadsRef.current = _prevLeadIds;
    _prevLeadIdsInitialised = true;
  }, [showBrowserNotification, playSound]);


  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setState(prev => ({
      ...prev,
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setState(prev => ({ ...prev, unreadCount: 0 }));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setState(prev => ({ ...prev, unreadCount: 0 }));
  }, []);

  return {
    ...state,
    notifications,
    requestPermission,
    toggleNotifications,
    toggleSound,
    checkNewHotLeads,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
};

export default useNotifications;
