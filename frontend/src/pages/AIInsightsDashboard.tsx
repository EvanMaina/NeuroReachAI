/**
 * AI Insights dashboard — premium SaaS rebuild.
 *
 * EVERY number on this page is grounded in real DB data. The narrative copy
 * (health_score.summary, recommendations, expansion.note) comes from the insight engine;
 * the metric values come from the server-side `metrics` block which always
 * reflects what the database actually says.
 *
 * Sections:
 *   1. Hero        — health score + 4 metric tiles (Active Pipeline, Insured
 *                    Open, Avg First Contact, plus 30d closer count).
 *   2. What's Happening Now — operational tiles (NEW untouched, stale follow-
 *                              ups, insured open, callbacks due, scheduled).
 *   3. Conversion funnel — 4 stages with stage-to-stage drop-off.
 *   4. How to Improve Conversions — recommendations + suggested scripts.
 *   5. Communication Insights — best time / channel computed from real
 *                              answer_rate_by_window × success_rate_by_method.
 *   6. Coordinator Performance — closer leaderboard (completed_by_user_id).
 *   7. Geographic Insights — resolved intake locations with conversion rate per area.
 *   8. Expansion Opportunities — distinct lead_location values w/ recency.
 */

import React, { useState } from 'react';
import {
  RefreshCw, Sparkles, TrendingUp, TrendingDown, Minus,
  AlertCircle, Flame, Target, MessageSquare, MapPin, Building2, Users,
  ArrowRight, Copy, Check, Loader2, Activity, Heart,
  Clock, Phone, Sun, Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { getAIInsights, refreshAIInsights } from '../services/aiInsights';
import type {
  IAIInsights, IRecommendation, IWhatsHappeningItem,
  IInsightMetrics, IWindowStat, IGeographicBreakdownRow,
} from '../services/aiInsights';

// =============================================================================
// Helpers
// =============================================================================

function trendIcon(trend: string) {
  if (trend === 'up') return <TrendingUp size={16} className="text-emerald-500 " />;
  if (trend === 'down') return <TrendingDown size={16} className="text-red-500 " />;
  return <Minus size={16} className="text-gray-400 " />;
}

/**
 * Single brand-consistent hero gradient regardless of health score.
 * Premium SaaS tools (Linear, Stripe, Vercel) keep one visual identity for the
 * top hero — they don't paint the whole card red when something is "at risk",
 * because that turns the dashboard into an alarm. The health score itself plus
 * the labelled pill convey the status; the gradient stays calm and on-brand.
 */
const HERO_GRADIENT = 'from-slate-900 via-indigo-900 to-violet-900';

/**
 * Pill colors for the health-score label only — small, labelled, scannable.
 */
function healthPillClass(score: number): string {
  if (score >= 75) return 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/40';
  if (score >= 55) return 'bg-blue-400/20 text-blue-100 ring-1 ring-blue-400/40';
  if (score >= 35) return 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/40';
  return 'bg-rose-400/20 text-rose-100 ring-1 ring-rose-400/40';
}

function toneClass(tone: string): string {
  switch (tone) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200   ';
    case 'warning':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200   ';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-slate-200   ';
  }
}

function impactBadge(impact: string) {
  const className =
    impact === 'high'
      ? 'bg-red-100 text-red-700  '
      : impact === 'medium'
        ? 'bg-amber-100 text-amber-700  '
        : 'bg-slate-100 text-slate-700  ';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${className}`}>
      {impact}
    </span>
  );
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

// =============================================================================
// Component
// =============================================================================

const WINDOW_LABELS: Record<string, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const METHOD_LABELS: Record<string, string> = {
  PHONE: 'Phone',
  SMS: 'SMS',
  EMAIL: 'Email',
  VIDEO_CALL: 'Video',
};

const AIInsightsDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRefreshingNarrative, setIsRefreshingNarrative] = useState(false);

  const query = useQuery({
    queryKey: ['ai-insights'],
    queryFn: getAIInsights,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const refresh = useMutation({
    mutationFn: refreshAIInsights,
    onMutate: () => {
      setIsRefreshingNarrative(true);
    },
    onSuccess: (response) => {
      if (response.insights) {
        queryClient.setQueryData(['ai-insights'], response.insights);
      }
      if (!response.task_id) {
        setIsRefreshingNarrative(false);
        return;
      }

      // Poll the insights endpoint while the Celery task upgrades the live
      // deterministic snapshot with AI-authored narrative.
      let attempts = 0;
      const tick = async () => {
        try {
          attempts += 1;
          const fresh = await getAIInsights();
          queryClient.setQueryData(['ai-insights'], fresh);
          if (fresh.metadata?.narrative_source === 'ai' || fresh.source === 'fresh' || attempts >= 10) {
            setIsRefreshingNarrative(false);
            return;
          }
          setTimeout(tick, Math.min(4_000 + attempts * 3_000, 10_000));
        } catch {
          setIsRefreshingNarrative(false);
        }
      };
      setTimeout(tick, 4_000);
    },
    onError: () => {
      setIsRefreshingNarrative(false);
    },
  });

  const insights: IAIInsights | undefined = query.data;
  const metrics: IInsightMetrics | undefined = insights?.metrics;
  const isLoading = query.isLoading || refresh.isPending || isRefreshingNarrative;
  const narrativeSource = insights?.metadata?.narrative_source;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50  ">
      <Sidebar currentPage="ai-insights" onNavigate={(p) => { window.location.hash = p; }} />

      <main className="nr-sidebar-ml p-4 sm:p-6 lg:p-8 flex-1 min-w-0">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900  tracking-tight">AI Insights</h1>
                <p className="text-sm text-slate-500 ">
                  Real-time pipeline intelligence from your live operational data.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(insights?.source === 'stub' || narrativeSource === 'deterministic' || isRefreshingNarrative) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800  ">
                <AlertCircle size={12} /> Live data — AI narrative refreshing
              </span>
            )}
            {narrativeSource === 'ai' && !isRefreshingNarrative && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800  ">
                <Sparkles size={12} /> Live insights
              </span>
            )}
            <button
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending || isRefreshingNarrative}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/30"
            >
              {refresh.isPending || isRefreshingNarrative ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {refresh.isPending || isRefreshingNarrative ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        {query.isLoading && !insights && (
          <div className="text-center py-24">
            <Loader2 size={28} className="mx-auto animate-spin text-indigo-500 mb-3" />
            <p className="text-sm text-slate-500 ">Loading insights…</p>
          </div>
        )}

        {query.isError && !insights && (
          <div className="text-center py-24 text-red-600 ">
            <AlertCircle size={28} className="mx-auto mb-3" />
            <p className="text-sm">Could not load AI Insights. Check the backend logs.</p>
          </div>
        )}

        {insights && (
          <div className="space-y-6">
            {/* ============================================================== */}
            {/* SECTION 1 — HERO: Health score + 4 real metric tiles            */}
            {/* Single brand gradient (no alarm-red). Health label is the pill. */}
            {/* ============================================================== */}
            <section className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white bg-gradient-to-br ${HERO_GRADIENT} shadow-xl`}>
              {/* Subtle grain/glow for premium feel */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,_white_0%,_transparent_55%)] opacity-10 pointer-events-none" />
              <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Health summary */}
                <div className="lg:col-span-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Activity size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Pipeline Health</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-sm ${healthPillClass(insights.health_score.score)}`}>
                          {insights.health_score.label}
                        </span>
                        {trendIcon(insights.health_score.trend)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-6xl font-bold tracking-tight">{insights.health_score.score}</span>
                    <span className="text-xl font-medium opacity-80">/100</span>
                  </div>
                  <p className="text-sm opacity-95 leading-relaxed max-w-md">
                    {insights.health_score.summary}
                  </p>
                </div>

                {/* Real metric tiles */}
                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <HeroTile
                    label="Active pipeline"
                    value={metrics?.active_pipeline ?? '—'}
                    sublabel="Workable today"
                    icon={<Zap size={16} />}
                  />
                  <HeroTile
                    label="Insured open"
                    value={metrics?.insured_open ?? '—'}
                    sublabel="Money on the table"
                    icon={<Heart size={16} />}
                  />
                  <HeroTile
                    label="Avg first contact"
                    value={
                      metrics?.avg_first_contact_hours != null
                        ? `${metrics.avg_first_contact_hours}h`
                        : '—'
                    }
                    sublabel="Time to first outreach"
                    icon={<Clock size={16} />}
                  />
                  <HeroTile
                    label="New untouched"
                    value={metrics?.new_untouched ?? '—'}
                    sublabel="Awaiting first contact"
                    icon={<Sparkles size={16} />}
                  />
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 2 — What's Happening Now                                */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <Activity size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">What's happening now</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Real-time pipeline snapshot showing where your leads stand today.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {insights.whats_happening.map((item: IWhatsHappeningItem, i) => (
                  <div key={i} className={`rounded-xl p-3.5 ${toneClass(item.tone)}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">
                      {item.label}
                    </p>
                    <p className="text-2xl font-bold leading-none mb-1.5">{item.value}</p>
                    <p className="text-[11px] leading-snug opacity-90">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 3 — Conversion Funnel                                   */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <Target size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">Conversion funnel</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Stage-by-stage drop-off across the pipeline.
              </p>
              <div className="space-y-2">
                {insights.funnel.map((stage, i) => {
                  const first = insights.funnel[0];
                  const pct = first.count > 0 ? (stage.count / first.count) * 100 : 0;
                  const stageColors = [
                    'from-blue-500 to-blue-600',
                    'from-indigo-500 to-purple-500',
                    'from-emerald-500 to-teal-500',
                    'from-amber-500 to-orange-500',
                  ];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-28 text-sm font-semibold text-slate-700  flex-shrink-0">
                        {stage.stage}
                      </div>
                      <div className="flex-1 h-9 bg-slate-100  rounded-lg overflow-hidden relative">
                        <div
                          className={`h-full bg-gradient-to-r ${stageColors[i % stageColors.length]} transition-all duration-700 ease-out`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-xs font-bold text-white drop-shadow">
                          {stage.count} {stage.count === 1 ? 'lead' : 'leads'}
                        </span>
                      </div>
                      <div className="w-20 text-right text-xs font-semibold text-slate-700  tabular-nums">
                        {first.count > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </div>
                      <div className="w-24 text-right text-xs text-slate-500 ">
                        {stage.conversion_from_prev != null
                          ? (i === 0 ? '—' : `${stage.conversion_from_prev}% step`)
                          : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 4 — How to Improve Conversions                          */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <Flame size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">How to improve conversions</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Strategic recommendations grounded in your actual data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.recommendations.map((rec: IRecommendation, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl ring-1 ring-slate-200  hover:ring-indigo-300  transition-colors bg-slate-50/50 "
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-900 ">{rec.title}</h3>
                      {impactBadge(rec.impact)}
                    </div>
                    <p className="text-xs text-slate-500  mb-2 leading-relaxed">{rec.why}</p>
                    <div className="flex items-start gap-2 text-xs text-indigo-700  font-medium leading-relaxed">
                      <ArrowRight size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{rec.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 5 — Communication Insights (REAL bars)                  */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <MessageSquare size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">Communication insights</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Best time and channel — computed directly from your contact attempts.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-purple-50   ring-1 ring-indigo-100 ">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sun size={12} className="text-indigo-600 " />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 ">Best time window</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900 ">
                    {insights.communication.best_time}
                  </p>
                  <p className="text-xs text-indigo-700/70  mt-1">
                    Highest answer rate from your call data
                  </p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50   ring-1 ring-purple-100 ">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Phone size={12} className="text-purple-600 " />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 ">Best contact method</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 ">
                    {insights.communication.best_channel}
                  </p>
                  <p className="text-xs text-purple-700/70  mt-1">
                    Channel with the highest success rate
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Answer rate by time of day — REAL bars */}
                <div className="rounded-xl ring-1 ring-slate-200  p-4 bg-slate-50/50 ">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500  mb-3">
                    Answer rate by time of day
                  </p>
                  {metrics?.answer_rate_by_window
                    ? Object.entries(metrics.answer_rate_by_window).map(([w, stat]) => (
                      <Bar
                        key={w}
                        label={WINDOW_LABELS[w] || w}
                        stat={stat}
                        emptyHint={stat.attempts === 0 ? 'No attempts in this window' : undefined}
                      />
                    ))
                    : <p className="text-xs text-slate-500 ">No data yet.</p>}
                </div>

                {/* Success rate by method — REAL bars */}
                <div className="rounded-xl ring-1 ring-slate-200  p-4 bg-slate-50/50 ">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500  mb-3">
                    Success rate by method
                  </p>
                  {metrics?.success_rate_by_method && Object.keys(metrics.success_rate_by_method).length > 0
                    ? Object.entries(metrics.success_rate_by_method).map(([m, stat]) => (
                      <Bar
                        key={m}
                        label={METHOD_LABELS[m] || m.replace(/_/g, ' ')}
                        stat={stat}
                        emptyHint={stat.attempts === 0 ? 'No attempts via this method' : undefined}
                      />
                    ))
                    : <p className="text-xs text-slate-500 ">No data yet.</p>}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 ">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500  mb-3 flex items-center gap-1.5">
                  <Copy size={12} /> Outreach scripts
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.communication.templates.map((tpl, i) => (
                    <TemplateRow key={i} title={tpl.title} scenario={tpl.scenario} body={tpl.body} />
                  ))}
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 6 — Coordinator Performance (closer leaderboard)        */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <Users size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">Coordinator performance</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Ranked by leads moved into the Completed queue (last 30 days).
              </p>
              {insights.coordinator_performance.length === 0 ? (
                <div className="text-center py-8 rounded-xl bg-slate-50  ring-1 ring-dashed ring-slate-200 ">
                  <p className="text-sm text-slate-500 ">
                    No coordinator data yet — completions will appear here once leads are closed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.coordinator_performance.slice(0, 5).map((c, i) => {
                    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-4 ring-1 ring-slate-200  bg-slate-50/30 "
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-xl ${colors[i] || 'bg-slate-500'} text-white flex items-center justify-center font-bold text-sm shadow`}>
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900  truncate">{c.name}</p>
                            <p className="text-xs text-slate-500 ">
                              {c.conversions} closed
                              {!c.note && ` · ${c.touches} assigned`}
                              {c.completions_30d != null && ` · ${c.completions_30d} this month`}
                            </p>
                            {c.note && (
                              <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                                {c.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-emerald-600 ">{c.rate}%</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 ">close rate</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100  rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, c.rate))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ============================================================== */}
            {/* SECTION 7 — Geographic Insights (intake locations)              */}
            {/* ============================================================== */}
            <section className="bg-white  ring-1 ring-slate-200  rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100  flex items-center justify-center">
                  <MapPin size={14} className="text-slate-600 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">Geographic insights</h2>
              </div>
              <p className="text-sm text-slate-500  mb-4 ml-10">
                Locations where leads are entering and converting from intake submissions.
                {typeof insights.geographic?.in_service_share === 'number' &&
                  ` ${insights.geographic.in_service_share}% of leads are inside the clinic service area.`}
              </p>
              {(metrics?.geographic_breakdown && metrics.geographic_breakdown.length > 0)
                ? (
                  <div className="space-y-2">
                    {metrics.geographic_breakdown.slice(0, 10).map((row: IGeographicBreakdownRow, i) => {
                      const max = metrics.geographic_breakdown![0]?.count || 1;
                      const widthPct = (row.count / max) * 100;
                      return (
                        <div key={`${row.kind}-${row.label}-${i}`} className="grid grid-cols-12 items-center gap-3">
                          <div className="col-span-3 lg:col-span-2 text-sm font-medium text-slate-700  truncate">
                            {row.label}
                          </div>
                          <div className="col-span-6 lg:col-span-8 h-7 bg-slate-100  rounded-lg overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                              style={{ width: `${Math.max(widthPct, 5)}%` }}
                            />
                            <span className="absolute inset-0 flex items-center px-3 text-xs font-bold text-white drop-shadow">
                              {row.count} {row.count === 1 ? 'lead' : 'leads'}
                            </span>
                          </div>
                          <div className="col-span-3 lg:col-span-2 text-right">
                            <p className={`text-sm font-bold tabular-nums ${
                              row.rate_pct >= 30
                                ? 'text-emerald-600 '
                                : row.rate_pct > 0
                                  ? 'text-slate-700 '
                                  : 'text-slate-400 '
                            }`}>
                              {row.rate_pct}%
                            </p>
                            <p className="text-[10px] text-slate-500 ">conversion</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 rounded-xl bg-slate-50  ring-1 ring-dashed ring-slate-200 ">
                    <MapPin size={20} className="mx-auto mb-2 text-slate-400 " />
                    <p className="text-sm font-semibold text-slate-700  mb-1">
                      No location data yet
                    </p>
                    <p className="text-xs text-slate-500 ">
                      Intake locations will populate this breakdown as leads submit the form.
                    </p>
                  </div>
                )}
            </section>

            {/* ============================================================== */}
            {/* SECTION 8 — Expansion Opportunities (from lead_location)        */}
            {/* ============================================================== */}
            <section className="rounded-2xl p-6 ring-1 ring-amber-200  bg-gradient-to-br from-amber-50 to-orange-50/50   shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-100  flex items-center justify-center">
                  <Building2 size={14} className="text-amber-700 " />
                </div>
                <h2 className="text-base font-bold text-slate-900 ">Expansion opportunities</h2>
              </div>
              <p className="text-sm text-slate-600  mb-4 ml-10 leading-relaxed">
                {insights.expansion.note}
              </p>
              {(metrics?.expansion_opportunities && metrics.expansion_opportunities.length > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {metrics.expansion_opportunities.slice(0, 8).map((opp, i) => (
                    <div key={i} className="rounded-xl p-3 bg-white/60  ring-1 ring-amber-200/60  backdrop-blur-sm">
                      <p className="text-sm font-semibold text-slate-900  truncate" title={opp.location}>
                        {opp.location}
                      </p>
                      <p className="text-[11px] text-amber-700  mt-0.5">
                        {opp.lead_count} lead{opp.lead_count !== 1 ? 's' : ''}
                        {opp.last_seen_iso && ` · ${fmtRelative(opp.last_seen_iso)}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 rounded-xl bg-white/60  ring-1 ring-dashed ring-amber-300/60 ">
                  <Target size={20} className="mx-auto mb-2 text-amber-600 " />
                  <p className="text-sm font-semibold text-amber-800  mb-1">
                    No locations recorded yet.
                  </p>
                  <p className="text-xs text-amber-700 ">
                    When coordinators record lead locations during calls, AI will identify expansion opportunities.
                  </p>
                </div>
              )}
            </section>

            {/* Footer */}
            <p className="pt-2 text-center text-[11px] text-slate-400  flex items-center justify-center gap-1.5">
              <Sparkles size={11} className="text-indigo-500 " />
              Real-time analysis refreshes on demand
              {isLoading && <Loader2 size={11} className="animate-spin ml-1" />}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

// =============================================================================
// HeroTile — premium metric card used inside the hero gradient block.
// =============================================================================

const HeroTile: React.FC<{
  label: string;
  value: number | string;
  sublabel: string;
  icon: React.ReactNode;
}> = ({ label, value, sublabel, icon }) => (
  <div className="rounded-xl p-3.5 bg-white/15 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
    <div className="flex items-center justify-between mb-2 opacity-90">
      {icon}
    </div>
    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">{label}</p>
    <p className="text-3xl font-bold leading-none mb-1.5 tabular-nums">{value}</p>
    <p className="text-[11px] leading-snug opacity-80">{sublabel}</p>
  </div>
);

// =============================================================================
// Bar — reusable horizontal bar for time-of-day / method breakdowns.
// =============================================================================

const Bar: React.FC<{ label: string; stat: IWindowStat; emptyHint?: string }> = ({
  label, stat, emptyHint,
}) => (
  <div className="mb-2 last:mb-0">
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-slate-700  font-medium">{label}</span>
      <span className="text-slate-500  tabular-nums">
        {stat.pct}%
        <span className="ml-1 text-[10px] opacity-70">({stat.successes}/{stat.attempts})</span>
      </span>
    </div>
    <div className="h-2 bg-slate-200  rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          stat.pct >= 50
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
            : stat.pct >= 25
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
              : 'bg-slate-400 '
        }`}
        style={{ width: `${Math.min(100, Math.max(0, stat.pct))}%` }}
      />
    </div>
    {emptyHint && (
      <p className="text-[10px] text-slate-400  mt-0.5">{emptyHint}</p>
    )}
  </div>
);

// =============================================================================
// TemplateRow — copyable communication template card
// =============================================================================

const TemplateRow: React.FC<{ title: string; scenario: string; body: string }> = ({
  title, scenario, body,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (HTTP context, old browser) — ignore.
    }
  };
  return (
    <div className="p-3 rounded-xl ring-1 ring-slate-200  bg-white ">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 ">{title}</p>
          <p className="text-[11px] text-slate-500 ">{scenario}</p>
        </div>
        <button
          onClick={copy}
          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200    transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-500 " /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-2 text-xs text-slate-700  whitespace-pre-wrap font-sans leading-relaxed">
        {body}
      </pre>
    </div>
  );
};

export default AIInsightsDashboard;
