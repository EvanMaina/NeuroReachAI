/**
 * AI Insights API client.
 *
 * Endpoints live at `/api/ai-insights*` — see `backend/src/api/ai_insights.py`
 * for shape guarantees. All calls go through the authenticated axios client.
 */

import { apiClient } from './api';

// =============================================================================
// Shapes — mirror ai_insights_service.SYSTEM_PROMPT's JSON contract.
// =============================================================================

export interface IHealthScore {
  score: number;
  label: 'Excellent' | 'Good' | 'Needs attention' | 'At risk' | string;
  summary: string;
  trend: 'up' | 'flat' | 'down' | string;
}

export interface IWhatsHappeningItem {
  label: string;
  value: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'warning' | string;
}

export interface IFunnelStage {
  stage: string;
  count: number;
  conversion_from_prev: number | null;
}

export interface IRecommendation {
  title: string;
  why: string;
  action: string;
  impact: 'high' | 'medium' | 'low' | string;
}

export interface ICommunicationTemplate {
  title: string;
  scenario: string;
  body: string;
}

export interface ICommunication {
  best_channel: string;
  best_time: string;
  templates: ICommunicationTemplate[];
}

export interface ICoordinatorPerformance {
  name: string;
  /** Total leads ever assigned/touched (assignment volume, kept for context). */
  touches: number;
  /** Lifetime closer count — leads moved into a converted status by this user. */
  conversions: number;
  /** Closer count in the last 30 days (momentum). Optional for legacy stub data. */
  completions_30d?: number;
  /** Closer rate = conversions / touches, %. */
  rate: number;
  note?: string;
}

export interface IGeographic {
  in_service_share: number;
  note: string;
}

export interface IExpansion {
  note: string;
  signals: string[];
}

export interface IDistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface IWindowStat {
  attempts: number;
  successes: number;
  pct: number;
}

export interface IGeographicBreakdownRow {
  label: string;
  /** "location" = resolved from intake ZIP; "zip" = raw ZIP fallback when unresolved. */
  kind: 'location' | 'zip' | string;
  count: number;
  conversions: number;
  zip_codes?: string[];
  rate_pct: number;
}

export interface IExpansionOpportunity {
  location: string;
  lead_count: number;
  last_seen_iso: string | null;
}

/**
 * Strictly-real metric block, attached server-side. Frontend should prefer
 * these values over anything AI model generated for the same field — this
 * block is the source of truth for numbers; AI model's response is the
 * source of truth for narrative copy only.
 */
export interface IInsightMetrics {
  active_pipeline?: number;
  insured_open?: number;
  avg_first_contact_hours: number | null;
  new_untouched?: number;
  new_last_7d?: number;
  no_answer_stale?: number;
  callbacks_due?: number;
  scheduled?: number;
  answer_rate_by_window?: Record<string, IWindowStat>;
  success_rate_by_method?: Record<string, IWindowStat>;
  geographic_breakdown?: IGeographicBreakdownRow[];
  expansion_opportunities?: IExpansionOpportunity[];
}

export interface IAIInsights {
  /** "cache" | "stub" | "fresh" — added by the API wrapper, not the model. */
  source: 'cache' | 'stub' | 'fresh' | string;
  health_score: IHealthScore;
  whats_happening: IWhatsHappeningItem[];
  funnel: IFunnelStage[];
  recommendations: IRecommendation[];
  communication: ICommunication;
  coordinator_performance: ICoordinatorPerformance[];
  geographic: IGeographic;
  expansion: IExpansion;
  tms_interest?: IDistributionItem[];
  lead_sources?: IDistributionItem[];
  /** Server-attached real metrics — see IInsightMetrics. */
  metrics?: IInsightMetrics;
  metadata?: {
    generated_at?: string;
    narrative_source?: 'ai' | 'deterministic' | string;
    refresh_state?: string;
    geographic_source?: string;
    expansion_source?: string;
  };
}

export interface IAIEmailDraftQueueContext {
  status?: string | null;
  contact_outcome?: string | null;
  priority?: string | null;
  follow_up_reason?: string | null;
}

export interface IAIEmailDraft {
  subject: string;
  body: string;
  /** Always true under the strict-AI policy. Kept for forward compatibility. */
  ai_generated: boolean;
  /** Queue context AI model reasoned over — surfaced in the dialog banner. */
  queue_context?: IAIEmailDraftQueueContext;
}

export interface IRefreshResponse {
  task_id: string | null;
  status: string;
  insights?: IAIInsights;
}

// =============================================================================
// Calls
// =============================================================================

export async function getAIInsights(): Promise<IAIInsights> {
  // Long timeout — the backend caches aggressively, but a stub-path refresh
  // can fan out to a Celery task and we don't want spurious UI errors.
  const res = await apiClient.get<IAIInsights>('/api/ai-insights', {
    timeout: 30_000,
  });
  return res.data;
}

export async function refreshAIInsights(): Promise<IRefreshResponse> {
  const res = await apiClient.post<IRefreshResponse>(
    '/api/ai-insights/refresh',
    {},
  );
  return res.data;
}

export async function getAIEmailDraft(leadId: string): Promise<IAIEmailDraft> {
  const res = await apiClient.get<IAIEmailDraft>(
    `/api/ai-insights/email-draft/${leadId}`,
    { timeout: 90_000 }, // AI model call can be slow
  );
  return res.data;
}
