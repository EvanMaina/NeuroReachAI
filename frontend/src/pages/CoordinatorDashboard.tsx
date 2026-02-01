/**
 * Coordinator Dashboard Page
 * 
 * Clean, world-class table-based lead management with:
 * - Queue-specific views (Hot, Medium, Low, Follow-up, Callback, Scheduled, Unreachable)
 * - Real-time notifications for hot leads
 * - Quick stats overview
 * - Lead detail slide-out panel
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, BellOff, Volume2, VolumeX, RefreshCw, 
  Flame, Users, Calendar, Clock, CheckCircle2,
  X, ChevronRight, PlusCircle, MessageCircle, Target
} from 'lucide-react';
import { Sidebar } from '../components/dashboard/Sidebar';
import { LeadsTable } from '../components/dashboard/LeadsTable';
import { LeadDetailModal } from '../components/dashboard/LeadDetailModal';
import { LeadEditModal } from '../components/dashboard/LeadEditModal';
import { ScheduleModal } from '../components/dashboard/ScheduleModal';
import { QuickActionPanel } from '../components/dashboard/QuickActionPanel';
import { ConsultationPanel } from '../components/dashboard/ConsultationPanel';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { filterLeadsByQueue, type QueueType } from '../components/dashboard/QueueSidebar';
import { useNotifications } from '../hooks/useNotifications';
import { useLeads, useDashboardSummary } from '../hooks/useLeads';
import { useAuth } from '../hooks/useAuth';
import { getLeadById, deleteLead } from '../services/leads';
import type { Lead, LeadTableRow, LeadStatus, ContactOutcome } from '../types/lead';

// Queue configuration for titles and colors
const QUEUE_CONFIG: Record<string, { title: string; subtitle: string; color: string; bgColor: string }> = {
  // Overview
  'all': { title: 'All Active Leads', subtitle: 'View and manage all active leads', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  // Contact Status Queues (Primary Workflow)
  'new': { title: 'New Leads', subtitle: 'Never contacted - First call needed', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  'contacted': { title: 'Contacted Leads', subtitle: 'All leads with contact attempts (inclusive view)', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'follow_up': { title: 'Follow-up Queue', subtitle: 'No answer - Needs retry', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  'callback': { title: 'Callback Requested', subtitle: 'Call back at requested time', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  // Outcome Queues
  'scheduled': { title: 'Scheduled Consultations', subtitle: 'Consultation booked - Ready for appointment', color: 'text-green-600', bgColor: 'bg-green-50' },
  'completed': { title: 'Completed Leads', subtitle: 'Consultation complete or treatment started', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  'unreachable': { title: 'Unreachable Leads', subtitle: 'Unable to contact - Needs review', color: 'text-slate-600', bgColor: 'bg-slate-50' },
  // Priority Queues (Cross-cutting views)
  'hot': { title: 'Hot Priority Leads', subtitle: 'Urgent - Contact within 1 hour', color: 'text-red-600', bgColor: 'bg-red-50' },
  'medium': { title: 'Medium Priority Leads', subtitle: 'Standard - Contact within 24 hours', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'low': { title: 'Low Priority Leads', subtitle: 'Regular follow-up schedule', color: 'text-blue-600', bgColor: 'bg-blue-50' },
};

interface CoordinatorDashboardProps {
  queueType?: string; // e.g., 'hot', 'medium', 'low', 'followup', 'callback', 'scheduled', 'unreachable'
}

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ queueType = 'all' }) => {
  const { hasPermission } = useAuth();
  const [currentPage, setCurrentPage] = useState('coordinator');
  
  // =========================================================================
  // GLOBAL STATE: Use React Query hook for data persistence across navigation
  // This prevents data loss when switching between queues/pages
  // =========================================================================
  const { 
    leads, 
    isLoading: isLeadsLoading, 
    error: leadsError,
    dataUpdatedAt,
    refresh: refreshLeads,
    updateStatus: updateLeadStatus,
    updateOutcome: updateLeadOutcome,
  } = useLeads({ autoRefresh: true, refetchInterval: 30000 });
  
  // Dashboard summary hook - also globally cached
  const { summary: dashboardSummaryData } = useDashboardSummary();
  
  // Local UI states (not data)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefresh = new Date(dataUpdatedAt || Date.now());
  const isLoading = isLeadsLoading && leads.length === 0;
  
  // Convert queueType prop to QueueType
  const activeQueue: QueueType = (queueType === 'followup' ? 'follow_up' : queueType) as QueueType;
  const queueConfig = QUEUE_CONFIG[activeQueue] || QUEUE_CONFIG['all'];
  
  // Detail panel state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // Quick Action Panel state (for rapid outcome recording - priority leads)
  const [quickActionLead, setQuickActionLead] = useState<LeadTableRow | null>(null);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  
  // Consultation Panel state (for scheduled leads)
  const [consultationLead, setConsultationLead] = useState<LeadTableRow | null>(null);
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  
  // Notification panel state
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  
  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleLeadInfo, setScheduleLeadInfo] = useState<{
    id: string;
    name: string;
    condition?: string;
    priority?: 'hot' | 'medium' | 'low';
    scheduleType?: 'callback' | 'consultation';
  } | null>(null);
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLeadInfo, setDeleteLeadInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  
  // =========================================================================
  // GLOBAL TOAST SYSTEM — Listens for CustomEvent('neuroreach:toast')
  // Dispatched by ConsultationPanel, QuickActionPanel, and other components.
  // Renders stacking toasts in top-right corner with auto-dismiss.
  // =========================================================================
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);
  const toastIdRef = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type: 'success' | 'error' };
      if (!detail?.message) return;
      const id = ++toastIdRef.current;
      setToasts(prev => [...prev, { id, message: detail.message, type: detail.type || 'success' }]);
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    window.addEventListener('neuroreach:toast', handler);
    return () => window.removeEventListener('neuroreach:toast', handler);
  }, []);

  // Dashboard summary from global hook (for "All Leads" view)
  // Note: dashboardSummaryData comes from useDashboardSummary hook above
  const dashboardSummary = dashboardSummaryData;

  // Notifications hook
  const {
    enabled: notificationsEnabled,
    soundEnabled,
    unreadCount,
    notifications,
    toggleNotifications,
    toggleSound,
    checkNewHotLeads,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();

  /**
   * METRICS CALCULATION UTILITIES
   * These calculate accurate metrics from local data for consistency with table counts.
   */
  
  // Helper: Check if a date is today
  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };
  
  // Helper: Calculate Response Rate for a set of leads
  // Response Rate = (ANSWERED + CALLBACK_REQUESTED) / (Leads with any contact attempt) × 100%
  const calculateResponseRate = (leadsSet: LeadTableRow[]): number => {
    const withContactAttempt = leadsSet.filter(l => 
      l.contactOutcome && l.contactOutcome !== 'NEW'
    );
    const successfulContacts = leadsSet.filter(l => 
      l.contactOutcome === 'ANSWERED' || l.contactOutcome === 'CALLBACK_REQUESTED'
    );
    return withContactAttempt.length > 0 
      ? Math.round((successfulContacts.length / withContactAttempt.length) * 100)
      : 0;
  };
  
  // Helper: Calculate Conversion Rate for a set of leads (QUEUE-AWARE)
  // - For Scheduled queue: % that completed consultation (COMPLETED / total)
  // - For Completed queue: always 100% (they already converted)
  // - For other queues: % that reached SCHEDULED status
  const calculateConversionRate = (leadsSet: LeadTableRow[], queue?: string): number => {
    if (leadsSet.length === 0) return 0;
    
    if (queue === 'scheduled') {
      // For Scheduled queue: show % that completed their consultation
      const completedLeads = leadsSet.filter(l => 
        l.status === 'consultation complete' || l.status === 'treatment started'
      );
      return Math.round((completedLeads.length / leadsSet.length) * 100);
    }
    
    if (queue === 'completed') {
      return 100; // All leads here have already converted
    }
    
    // For all other queues: % that reached scheduled/complete/treatment
    const scheduledLeads = leadsSet.filter(l => 
      l.status === 'scheduled' || l.status === 'consultation complete' || l.status === 'treatment started'
    );
    return Math.round((scheduledLeads.length / leadsSet.length) * 100);
  };
  
  // Helper: Count leads added to THIS queue today
  // - For 'new' queue: use submittedAt (creation date) — these ARE new leads
  // - For all other queues: use lastUpdatedAt (when the lead was last modified,
  //   which is a proxy for "when did this lead enter this queue")
  const calculateAddedToday = (leadsSet: LeadTableRow[], queue?: string): number => {
    if (queue === 'new' || queue === 'all') {
      // For New/All queue, creation date is the right metric
      return leadsSet.filter(l => isToday(l.submittedAt)).length;
    }
    // For other queues, use lastUpdatedAt as proxy for "entered queue today"
    return leadsSet.filter(l => l.lastUpdatedAt && isToday(l.lastUpdatedAt)).length;
  };

  // Get the filtered leads for current queue — memoized to prevent redundant recalculation
  const filteredQueueLeads = useMemo(
    () => filterLeadsByQueue(leads, activeQueue),
    [leads, activeQueue]
  );
  
  // Calculate queue-specific metrics from local data (pass activeQueue for queue-aware logic)
  const queueLocalMetrics = {
    inQueue: filteredQueueLeads.length,
    addedToday: calculateAddedToday(filteredQueueLeads, activeQueue),
    responseRate: calculateResponseRate(filteredQueueLeads),
    conversionRate: calculateConversionRate(filteredQueueLeads, activeQueue),
  };
  
  // Calculate global stats (for 'all' queue view)
  const globalResponseRate = calculateResponseRate(leads);
  
  const stats = {
    hotLeads: leads.filter(l => l.priority === 'hot' && l.status !== 'scheduled' && l.status !== 'consultation complete').length,
    totalNew: leads.filter(l => l.contactOutcome === 'NEW' || !l.contactOutcome).length,
    responseRate: globalResponseRate,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    completed: leads.filter(l => l.status === 'consultation complete').length,
    addedToday: calculateAddedToday(leads, 'all'),
  };

  // Check for new hot leads when leads data changes
  useEffect(() => {
    if (leads.length > 0) {
      checkNewHotLeads(leads);
    }
  }, [leads, checkNewHotLeads]);

  // Handle navigation
  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
  }, []);

  // Handle lead click - Open appropriate panel based on lead status
  const handleLeadClick = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    if (lead) {
      if (lead.status === 'scheduled') {
        // Open Consultation Panel for scheduled leads
        setConsultationLead(lead);
        setIsConsultationOpen(true);
      } else {
        // Open Quick Action Panel for priority leads (hot/medium/low)
        setQuickActionLead(lead);
        setIsQuickActionOpen(true);
      }
    }
  }, [leads]);

  // Handle viewing full lead details (from QuickActionPanel)
  const handleViewFullDetails = useCallback(async (id: string) => {
    setIsQuickActionOpen(false);
    setQuickActionLead(null);
    setIsLoadingDetail(true);
    setIsDetailOpen(true);
    
    try {
      const response = await getLeadById(id) as any;
      
      const leadData: Lead = {
        id: response.id || id,
        leadId: response.lead_number || 'TMS-2026-XXX',
        firstName: response.first_name || 'Unknown',
        lastName: response.last_name || '',
        email: response.email || '',
        phone: response.phone || '',
        primaryCondition: (response.condition || 'DEPRESSION') as Lead['primaryCondition'],
        symptomDuration: response.symptom_duration || 'Unknown',
        priorTreatments: response.prior_treatments || [],
        currentMedications: false,
        hasInsurance: response.has_insurance ?? false,
        insuranceProvider: response.insurance_provider || '',
        zipCode: response.zip_code || '',
        isInServiceArea: response.in_service_area ?? false,
        desiredStart: (response.urgency?.toLowerCase() || 'exploring') as Lead['desiredStart'],
        preferredContactMethod: 'phone',
        leadScore: response.score || 0,
        priority: (response.priority?.toLowerCase() || 'low') as Lead['priority'],
        status: (response.status?.toLowerCase() || 'new') as Lead['status'],
        utmSource: response.utm_source,
        utmMedium: response.utm_medium,
        utmCampaign: response.utm_campaign,
        createdAt: response.created_at || new Date().toISOString(),
        updatedAt: response.updated_at || new Date().toISOString(),
      };
      
      setSelectedLead(leadData);
    } catch (error) {
      console.error('Error fetching lead:', error);
      setSelectedLead(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Handle status change - uses optimistic update via React Query
  const handleStatusChange = useCallback((leadId: string, newStatus: LeadStatus) => {
    updateLeadStatus(leadId, newStatus);
  }, [updateLeadStatus]);

  // Handle contact outcome change - uses optimistic update via React Query
  const handleOutcomeChange = useCallback((leadId: string, newOutcome: ContactOutcome) => {
    updateLeadOutcome(leadId, newOutcome);
  }, [updateLeadOutcome]);

  // Handle manual refresh - uses React Query refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshLeads();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLeads]);

  // Close detail panel
  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedLead(null);
  }, []);

  // Open schedule modal for a lead
  const handleOpenSchedule = useCallback((lead: LeadTableRow | Lead, scheduleType?: 'callback' | 'consultation') => {
    setScheduleLeadInfo({
      id: lead.id,
      name: `${'firstName' in lead ? lead.firstName : ''} ${'lastName' in lead ? lead.lastName : ''}`.trim() || 'Unknown',
      condition: 'primaryCondition' in lead ? lead.primaryCondition : ('condition' in lead ? lead.condition : undefined),
      priority: lead.priority as 'hot' | 'medium' | 'low',
      scheduleType: scheduleType || 'callback',
    });
    setIsScheduleModalOpen(true);
  }, []);

  // Handle schedule success - uses React Query refresh
  const handleScheduleSuccess = useCallback(async () => {
    await refreshLeads(); // Refresh leads to show updated status
    setIsScheduleModalOpen(false);
    setScheduleLeadInfo(null);
  }, [refreshLeads]);

  // Close schedule modal
  const handleCloseSchedule = useCallback(() => {
    setIsScheduleModalOpen(false);
    setScheduleLeadInfo(null);
  }, []);

  // Open edit modal for a lead
  const handleEditLead = useCallback(async (leadId: string) => {
    setIsLoadingEdit(true);
    setIsEditModalOpen(true);
    
    try {
      const response = await getLeadById(leadId) as any;
      
      // Safely extract string values — handles null, undefined, "null", "undefined" as empty
      const safe = (val: unknown): string => {
        if (val == null) return '';
        const s = String(val).trim();
        if (['null', 'undefined', 'none', 'NULL', 'UNDEFINED', 'NONE'].includes(s)) return '';
        return s;
      };
      
      // Normalize status: backend returns UPPER_CASE, frontend expects "lower case" with spaces
      const rawStatus = safe(response.status || response.Status);
      const normalizedStatus = rawStatus.toLowerCase().replace(/_/g, ' ') || 'new';
      
      // Normalize priority: backend returns UPPER_CASE, frontend expects lowercase
      const normalizedPriority = safe(response.priority).toLowerCase() || 'low';
      
      // Convert API response (snake_case) to Lead type (camelCase)
      // CRITICAL: Every field must have null-safe fallbacks for Google Ads leads
      // which have many empty/null fields (no condition, no zip, no insurance, etc.)
      const leadData: Lead = {
        id: safe(response.id) || leadId,
        leadId: safe(response.lead_number) || safe(response.id) || leadId,
        firstName: safe(response.first_name || response.firstName),
        lastName: safe(response.last_name || response.lastName),
        email: safe(response.email),
        phone: safe(response.phone),
        condition: safe(response.condition),
        primaryCondition: (safe(response.condition) || 'OTHER') as Lead['primaryCondition'],
        symptomDuration: safe(response.symptom_duration || response.symptomDuration),
        priorTreatments: Array.isArray(response.prior_treatments) ? response.prior_treatments 
                       : Array.isArray(response.priorTreatments) ? response.priorTreatments : [],
        currentMedications: false,
        hasInsurance: response.has_insurance ?? response.hasInsurance ?? false,
        insuranceProvider: safe(response.insurance_provider || response.insuranceProvider),
        zipCode: safe(response.zip_code || response.zipCode),
        isInServiceArea: response.in_service_area ?? response.isInServiceArea ?? false,
        desiredStart: (safe(response.urgency).toLowerCase() || 'exploring') as Lead['desiredStart'],
        urgency: safe(response.urgency),
        preferredContactMethod: 'phone',
        leadScore: response.score || response.leadScore || 0,
        priority: normalizedPriority as Lead['priority'],
        status: normalizedStatus as Lead['status'],
        notes: safe(response.notes),
        utmSource: safe(response.utm_source || response.utmSource) || undefined,
        utmMedium: safe(response.utm_medium || response.utmMedium) || undefined,
        utmCampaign: safe(response.utm_campaign || response.utmCampaign) || undefined,
        createdAt: safe(response.created_at || response.createdAt) || new Date().toISOString(),
        updatedAt: safe(response.updated_at || response.updatedAt) || new Date().toISOString(),
      };
      
      setEditLead(leadData);
    } catch (error) {
      console.error('Error fetching lead for edit:', error);
      setEditLead(null);
      setIsEditModalOpen(false);
    } finally {
      setIsLoadingEdit(false);
    }
  }, []);

  // Handle edit success - only refresh leads; modal handles its own close via onClose
  const handleEditSuccess = useCallback(async () => {
    await refreshLeads();
  }, [refreshLeads]);

  // Close edit modal
  const handleCloseEdit = useCallback(() => {
    setIsEditModalOpen(false);
    setEditLead(null);
  }, []);

  // Open delete confirmation dialog
  const handleOpenDelete = useCallback((leadId: string, leadName: string) => {
    setDeleteLeadInfo({ id: leadId, name: leadName });
    setIsDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation — separated delete from refresh to prevent false "Failed" errors
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteLeadInfo) return;
    
    // Step 1: Delete the lead (this is the critical operation)
    const result = await deleteLead(deleteLeadInfo.id);
    
    // Step 2: Close dialog immediately on success (don't wait for refresh)
    setIsDeleteDialogOpen(false);
    setDeleteLeadInfo(null);
    
    // Step 3: Show success toast
    setDeleteSuccessMessage(result.message || `Lead deleted successfully.`);
    setTimeout(() => setDeleteSuccessMessage(null), 4000);
    
    // Step 4: Refresh leads list in background (errors here won't affect UX)
    try {
      await refreshLeads();
    } catch {
      // Silently ignore refresh errors — the delete already succeeded
    }
  }, [deleteLeadInfo, refreshLeads]);

  // Close delete dialog
  const handleCloseDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteLeadInfo(null);
  }, []);

  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Content — Flexbox fixed layout: only table body rows scroll */}
      <main className="ml-60 h-screen flex flex-col overflow-hidden">
        {/* Header — flex-shrink-0, fixed at top */}
        <div className="flex items-center justify-between px-6 pt-4 pb-1 flex-shrink-0 bg-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeQueue === 'all' ? 'All Leads Dashboard' : 'Coordinator Dashboard'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {activeQueue === 'all' 
                ? 'View and manage all leads in the system' 
                : 'Manage leads and track progress in real-time'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Last refresh indicator */}
            <span className="text-xs text-gray-400">
              Last updated: {formatTimeAgo(lastRefresh)}
            </span>
            
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              title="Refresh leads"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-200'
              }`}
              title={soundEnabled ? 'Mute notifications' : 'Enable sound'}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>

            {/* Notification toggle */}
            <button
              onClick={toggleNotifications}
              className={`p-2 rounded-lg transition-colors ${
                notificationsEnabled ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-200'
              }`}
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
            </button>

            {/* Notification bell with count */}
            <button
              onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats — flex-shrink-0, fixed above table */}
        <div className="flex-shrink-0 px-6 pb-2 bg-gray-100">
        {activeQueue !== 'all' ? (
          // =====================================================================
          // Queue-Specific Metrics Cards — World-Class Design
          // Compact, accent-colored, premium SaaS feel (Stripe/Linear/Vercel style)
          // =====================================================================
          <div className="grid grid-cols-4 gap-4">
            {/* In Queue — Indigo accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-indigo-500"
              title={`${queueLocalMetrics.inQueue} leads currently in this queue`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{queueLocalMetrics.inQueue}</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">In Queue</p>
                </div>
              </div>
            </div>

            {/* Added Today — Emerald accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-emerald-500"
              title="Leads created today (by submission date)"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <PlusCircle size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{queueLocalMetrics.addedToday}</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Added Today</p>
                </div>
              </div>
            </div>

            {/* Response Rate — Amber accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-amber-500"
              title="Response Rate = (Answered + Callback Requested) / Total Contacted in this queue × 100%"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{queueLocalMetrics.responseRate}%</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response Rate</p>
                </div>
              </div>
            </div>

            {/* Conversion Rate — Violet accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-violet-500"
              title="Conversion Rate = Leads that reached Scheduled status / Total in Queue × 100%"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Target size={18} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{queueLocalMetrics.conversionRate}%</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conversion Rate</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // =====================================================================
          // Global Stats (All Leads view) — World-Class Design
          // Same premium card style with unique accent colors per metric
          // =====================================================================
          <div className="grid grid-cols-5 gap-3.5">
            {/* Active Leads — Indigo accent (MATCHES TABLE COUNT) */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-indigo-500"
              title="Active leads excluding completed/lost/disqualified — Matches table count"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">
                    {dashboardSummary ? dashboardSummary.active_leads : leads.length}
                  </p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Leads</p>
                </div>
              </div>
            </div>

            {/* Hot Leads — Red/Rose accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-rose-500"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <Flame size={18} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">
                    {dashboardSummary ? dashboardSummary.hot_leads : stats.hotLeads}
                  </p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hot Leads</p>
                </div>
              </div>
            </div>

            {/* New Leads — Emerald accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-emerald-500"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">
                    {dashboardSummary ? dashboardSummary.new_leads : stats.totalNew}
                  </p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">New Leads</p>
                </div>
              </div>
            </div>

            {/* Response Rate — Amber accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-amber-500"
              title="Response Rate = (Answered + Callback Requested) / Total Contacted × 100%"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">
                    {dashboardSummary ? dashboardSummary.overall_response_rate : stats.responseRate}%
                  </p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response Rate</p>
                </div>
              </div>
            </div>

            {/* Scheduled Today — Violet accent */}
            <div
              className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm border-l-[3.5px] border-l-violet-500"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={18} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-tight">
                    {dashboardSummary ? dashboardSummary.scheduled_today : stats.scheduled}
                  </p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled Today</p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Main Content Area — flex-1 fills remaining viewport, min-h-0 enables nested flex scroll */}
        <div className="flex-1 min-h-0 flex flex-col mx-6 mb-2 mt-2 rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          {/* Queue Title Header — flex-shrink-0 */}
          <div className={`flex-shrink-0 px-4 py-2 border-b border-gray-200 ${queueConfig.bgColor}`}>
            <h2 className={`text-base font-semibold ${queueConfig.color}`}>
              {queueConfig.title}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {queueConfig.subtitle} • {filteredQueueLeads.length} leads
            </p>
          </div>
          
          {/* Clean Table View — flex-1 passes remaining space to LeadsTable */}
          <div className="flex-1 min-h-0 flex flex-col p-2 lg:p-3">
            <LeadsTable
              leads={filteredQueueLeads}
              totalCount={filteredQueueLeads.length}
              isLoading={isLoading}
              error={leadsError}
              onRetry={handleRefresh}
              onView={handleLeadClick}
              onEdit={hasPermission('edit_leads') ? handleEditLead : undefined}
              onDelete={hasPermission('delete_leads') ? handleOpenDelete : undefined}
              resetFilterKey={activeQueue}
              onRefreshNeeded={refreshLeads}
            />
          </div>
        </div>
      </main>

      {/* Notification Panel (Slide-out) */}
      {isNotificationPanelOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsNotificationPanelOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={clearAll}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear all
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsNotificationPanelOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Bell size={48} className="mb-2 opacity-50" />
                  <p>No notifications yet</p>
                  <p className="text-xs mt-1">New hot leads will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        handleLeadClick(notif.leadId);
                        setIsNotificationPanelOpen(false);
                      }}
                      className={`
                        px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors
                        ${!notif.read ? 'bg-red-50' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Flame size={16} className="text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">
                            🔥 New Hot Lead
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {notif.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {notif.condition} • {formatTimeAgo(notif.timestamp)}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Lead Detail Modal — read-only (scheduling moved to QuickActionPanel) */}
      <LeadDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        lead={selectedLead}
        isLoading={isLoadingDetail}
      />

      {/* Schedule Modal */}
      {scheduleLeadInfo && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={handleCloseSchedule}
          leadId={scheduleLeadInfo.id}
          leadName={scheduleLeadInfo.name}
          leadCondition={scheduleLeadInfo.condition}
          leadPriority={scheduleLeadInfo.priority}
          scheduleType={scheduleLeadInfo.scheduleType}
          onScheduleSuccess={handleScheduleSuccess}
        />
      )}

      {/* Quick Action Panel - Unified action dialog with inline scheduling */}
      <QuickActionPanel
        lead={quickActionLead}
        isOpen={isQuickActionOpen}
        onClose={() => {
          setIsQuickActionOpen(false);
          setQuickActionLead(null);
        }}
        onOutcomeChange={(leadId, newOutcome) => {
          handleOutcomeChange(leadId, newOutcome);
          if (quickActionLead && quickActionLead.id === leadId) {
            setQuickActionLead(prev => prev ? {
              ...prev,
              contactOutcome: newOutcome,
              contactAttempts: (prev.contactAttempts || 0) + 1,
            } : null);
          }
        }}
        onScheduleSuccess={async () => {
          setIsQuickActionOpen(false);
          setQuickActionLead(null);
          await refreshLeads();
        }}
        onViewDetails={handleViewFullDetails}
        canEdit={hasPermission('edit_leads')}
      />

      {/* Consultation Panel - Slide-out for scheduled lead consultations */}
      <ConsultationPanel
        lead={consultationLead}
        isOpen={isConsultationOpen}
        onClose={() => {
          setIsConsultationOpen(false);
          setConsultationLead(null);
          // Refresh leads to pick up latest status/queue changes
          refreshLeads();
        }}
        onStatusChange={(leadId, newStatus) => {
          handleStatusChange(leadId, newStatus);
          // Panel calls onClose itself after executing outcome
        }}
        onReschedule={(lead) => {
          setIsConsultationOpen(false);
          setConsultationLead(null);
          handleOpenSchedule(lead);
        }}
        onViewDetails={(leadId) => {
          setIsConsultationOpen(false);
          setConsultationLead(null);
          handleViewFullDetails(leadId);
        }}
      />

      {/* Lead Edit Modal */}
      <LeadEditModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEdit}
        lead={editLead}
        isLoading={isLoadingEdit}
        onSaveSuccess={handleEditSuccess}
      />

      {/* Delete Success Toast */}
      {deleteSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg">
            <CheckCircle2 size={20} />
            <span className="text-sm font-medium">{deleteSuccessMessage}</span>
            <button onClick={() => setDeleteSuccessMessage(null)} className="ml-2 opacity-80 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteLeadInfo && (
        <DeleteConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          title="Delete Lead"
          itemName={deleteLeadInfo.name}
          itemType="lead"
          warningMessage="This will soft-delete the lead. The record can be restored by an administrator if needed."
        />
      )}

      {/* ================================================================= */}
      {/* GLOBAL TOAST CONTAINER — Top-right, stacking, auto-dismiss        */}
      {/* Listens for neuroreach:toast CustomEvents from all child panels    */}
      {/* ================================================================= */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`
                pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg
                animate-in slide-in-from-right duration-300
                ${toast.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white'}
              `}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={20} className="flex-shrink-0" />
              ) : (
                <X size={20} className="flex-shrink-0" />
              )}
              <span className="text-sm font-medium max-w-xs">{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-2 opacity-80 hover:opacity-100 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoordinatorDashboard;
