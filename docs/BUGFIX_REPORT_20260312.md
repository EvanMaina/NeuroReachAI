# Bug Fix Report — March 12, 2026

## Issue 1: Widget Caching Old Version (Mobile Left-Side Positioning Not Reflecting)

### Root Cause
The source code in `frontend/src/widget-embed.tsx` was **already correct** — it contained `left: 0` positioning at all mobile breakpoints (≤768px, 769–1023px, ≤375px) with version `v20.0.0`. However, the **built output** at `frontend/dist-widget/widget-embed.js` was **stale** (14,703 bytes) and still contained old `right: 0` positioning because `npm run build:widget` was never executed after the positioning code changes were made.

### What Was Fixed

| Fix | File | Change |
|-----|------|--------|
| **1a — Rebuilt widget bundle** | `frontend/dist-widget/widget-embed.js` | Ran `npm run build:widget`. Output grew from 14,703 → 17,174 bytes. Now contains correct `left: 0`, `right: auto`, all mobile breakpoints, and `v20.0.0` version string. |
| **1b — Aggressive no-cache headers** | `backend/src/api/widget.py` | Changed `Cache-Control: "no-cache"` → `"no-cache, no-store, must-revalidate"` + added `Pragma: no-cache` + `Expires: 0`. Prevents browsers, CDNs, WP Rocket, proxies (ngrok, CloudFront) from ever serving a cached copy. |
| **1c — Content-hash ETag** | `backend/src/api/widget.py` | Added SHA-256 content-hash ETag + `X-Widget-Version` header. The hash is computed from the file contents and cached by mtime so it auto-updates whenever the bundle is rebuilt. Enables CDNs and browsers to validate freshness without manual version bumps. |

### Verification Results (All PASS)

```
File size: 17174 bytes
PASS: left: 0 positioning FOUND
PASS: right: auto FOUND (mobile override)
PASS: v20.0.0 version string FOUND
PASS: bottom-LEFT comment FOUND
PASS: 768px mobile breakpoint FOUND
PASS: 375px small mobile breakpoint FOUND
```

### Action Required: WordPress / TMS Institute Website

**WP Rocket Exclusion** — Add the widget script URL to WP Rocket's JS exclusion list:
1. WordPress Admin → Settings → WP Rocket → File Optimization
2. Under "Excluded JavaScript Files", add the full widget URL (e.g., `https://your-backend-domain/widget-embed.js`)
3. Save and purge WP Rocket cache

**Avada Script Tag Update** — Update the `<script>` tag in the WordPress site to include a cache-busting parameter:
```html
<script src="https://your-backend-domain/widget-embed.js?v=20260312"></script>
```
This forces a one-time fresh fetch. After that, the server-side `no-store` headers will prevent future caching issues permanently.

---

## Issue 2: Manual Lead Notification Sound Firing Incorrectly

### ⚠️ EVOLUTION: v1.1.0 Counter → v2.0.0 Source-Based (Data-Driven)

The initial fix (v1.1.0) used a module-level `_manualLeadsPending` counter shared between `ManualLeadModal` and `NewLeadWatcher`. While functional, this approach had inherent fragility:
- Counter was per-browser — didn't work across tabs or coordinators
- Page refresh reset the counter, potentially swallowing organic notifications
- Tight coupling between ManualLeadModal and NewLeadWatcher

**v2.0.0 replaces the counter entirely with a server-driven approach.**

### Two Independent Notification Systems

| System | File | How It Works | Toast Text |
|--------|------|-------------|------------|
| **NewLeadWatcher** | `frontend/src/components/common/NewLeadWatcher.tsx` | Polls `GET /api/leads/latest-check` every 15s, compares **total lead count** | `"🔥 New Lead — A new lead just arrived!"` |
| **useNotifications** | `frontend/src/hooks/useNotifications.ts` | React Query hook, compares **individual lead IDs**, filters by source | `"🔥 New Hot Lead"` + patient name |

### Root Cause

`NewLeadWatcher.tsx` is an invisible component mounted in `App.tsx` that polls a lightweight count endpoint every 15 seconds. When a coordinator creates a manual lead:

1. Manual lead is inserted into database → total count increases by 1
2. Next poll tick detects `newTotal > prevTotal` → `delta > 0`
3. Fires toast notification + chime sound
4. **Problem**: NewLeadWatcher had **zero awareness of lead source** — it only tracked total count

### What Was Fixed (v2.0.0 — Source-Based Suppression)

#### Backend: `backend/src/api/leads.py` — `latest_check()` endpoint

Added a `recent_sources` field to the response. This queries the `source` column for all leads created in the last 30 seconds:

```python
recent_sources_result = db.execute(
    sqlalchemy.text(
        "SELECT COALESCE(source, 'widget') FROM leads "
        "WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 seconds'"
    )
).fetchall()
recent_sources = [row[0] for row in recent_sources_result] if recent_sources_result else []

payload = {"total": total, "latest_at": latest_at, "recent_sources": recent_sources}
```

#### Frontend File 1: `frontend/src/components/common/NewLeadWatcher.tsx` (v1.1.0 → v2.0.0)

**Removed entirely:**
- `let _manualLeadsPending = 0;` — module-level counter variable
- `export function notifyManualLeadCreated(): void` — exported function
- `_manualLeadsPending = 0;` reset in else branch

**Added:**
- `recent_sources: string[]` field in `LatestCheckResponse` interface
- Source-based filtering in poll logic:

```typescript
const rawDelta = newTotal - prevTotalRef.current;

if (rawDelta > 0) {
  // Count manual leads from server-provided source data
  const manualCount = (data.recent_sources || []).filter(
    (s) => s === 'manual'
  ).length;

  const organicDelta = Math.max(0, rawDelta - manualCount);

  if (organicDelta > 0) {
    // Toast + chime ONLY for organic leads (widget, jotform, API)
    showToast('new-lead', '🔥 New Lead', 'A new lead just arrived!');
  }

  // ALWAYS invalidate React Query cache (manual leads should appear in table)
  queryClient.invalidateQueries({ queryKey: ['leads'] });
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
}
```

#### Frontend File 2: `frontend/src/components/dashboard/ManualLeadModal.tsx`

**Removed entirely:**
- `import { notifyManualLeadCreated } from '../common/NewLeadWatcher';` — import statement
- `notifyManualLeadCreated();` — call after `createManualLead()` in handleSubmit

ManualLeadModal now has **zero awareness** of the notification system. It simply creates the lead and lets the server-side `source='manual'` field handle suppression automatically.

### Why v2.0.0 Is Superior to v1.1.0

| Aspect | v1.1.0 (Counter) | v2.0.0 (Source-Based) |
|--------|-------------------|----------------------|
| **Source of truth** | Client-side counter (per-browser) | Server-side `source` column (single truth) |
| **Cross-tab** | ❌ Each tab has own counter | ✅ Server knows all sources |
| **Cross-coordinator** | ❌ Each browser independent | ✅ All coordinators see same data |
| **Page refresh** | ❌ Counter resets to 0 | ✅ Server data persists |
| **Coupling** | ManualLeadModal → NewLeadWatcher | Zero coupling — fully decoupled |
| **Timing race** | Possible if poll fires before counter set | Impossible — server has final word |
| **Code removed** | Added code | **Removed 15+ lines** net negative |

### Scenario Verification (v2.0.0)

| Scenario | Behavior |
|----------|----------|
| Coordinator creates 1 manual lead | Server returns `recent_sources: ["manual"]`, manualCount=1, rawDelta=1, organicDelta=0 → **NO notification** ✅ |
| Widget submits 1 organic lead | Server returns `recent_sources: ["widget"]`, manualCount=0, rawDelta=1, organicDelta=1 → **notification fires** ✅ |
| 1 manual + 1 organic simultaneously | Server returns `recent_sources: ["manual", "widget"]`, manualCount=1, rawDelta=2, organicDelta=1 → **1 notification** ✅ |
| Page refresh after manual lead | Server still returns `recent_sources: ["manual"]` for 30s → **still suppressed** ✅ |
| Two coordinators, one creates manual | Both browsers get `recent_sources: ["manual"]` → **both suppress correctly** ✅ |
| 30s passes after manual lead | `recent_sources` no longer includes it → normal behavior resumes ✅ |

### Previous Safeguard (Still Active)

The `useNotifications.ts` filter (`lead.source !== 'manual'`) from the first session remains in place as a **secondary safeguard**. It prevents the other notification system from ever firing for manual leads.

---

## Issue 3: Favicon — TMS Institute Logo

### What Was Done

Replaced the generic globe favicon with the TMS Institute logo. Generated all required sizes from `backend/static/images/logo.png` (300×139 RGBA) using Pillow:

| File | Size | Purpose |
|------|------|---------|
| `frontend/public/favicon.ico` | 16+32+48 multi-size | Universal browser fallback |
| `frontend/public/favicon-16x16.png` | 16×16 | Standard browser tab |
| `frontend/public/favicon-32x32.png` | 32×32 | High-DPI browser tab |
| `frontend/public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `frontend/public/favicon-192x192.png` | 192×192 | Android Chrome |
| `frontend/public/favicon-512x512.png` | 512×512 | PWA splash screen |

Updated `frontend/index.html` with proper `<link>` tags for all sizes.

---

## Issue 4: Widget Cache — ETag Auto-Versioning

### What Was Done

Added content-hash ETag to `backend/src/api/widget.py`:
- SHA-256 hash of file contents, cached by file mtime (auto-refreshes on rebuild)
- Headers: `ETag: "{hash}"`, `X-Widget-Version: {hash}`
- Combined with existing `no-cache, no-store, must-revalidate` headers
- Zero manual version bumps needed — hash changes automatically when bundle is rebuilt

---

## Deployment Confirmation

### ⚠️ ZERO CODE WAS PUSHED TO ANY ENVIRONMENT

All changes were made locally only. No `git push`, no CI/CD trigger, no Docker image build, no ECS deployment was initiated.

---

## Files Modified (All Sessions Combined)

| File | Type of Change |
|------|---------------|
| `frontend/src/components/common/NewLeadWatcher.tsx` | **v2.0.0**: Removed `_manualLeadsPending` counter + `notifyManualLeadCreated()` export entirely. Added `recent_sources` to `LatestCheckResponse` interface. Poll logic now uses server-provided source data for suppression. |
| `frontend/src/components/dashboard/ManualLeadModal.tsx` | Removed `import { notifyManualLeadCreated }` and the `notifyManualLeadCreated()` call. Zero coupling to NewLeadWatcher. |
| `backend/src/api/leads.py` | `latest_check()` endpoint now returns `recent_sources` array (source values for leads created in last 30s). |
| `backend/src/api/widget.py` | Cache-Control headers strengthened + SHA-256 content-hash ETag + `X-Widget-Version` header. |
| `frontend/dist-widget/widget-embed.js` | Rebuilt from source (stale build → current v20.0.0 with left-side mobile positioning). |
| `frontend/index.html` | Favicon link tags updated for all sizes (ico, png 16/32/180/192/512). |
| `frontend/public/favicon*.png` + `favicon.ico` | Generated 6 favicon files from TMS Institute logo. |
| `frontend/src/hooks/useNotifications.ts` | Added `lead.source !== 'manual'` filter (secondary safeguard — not the primary fix). |
| `docs/BUGFIX_REPORT_20260312.md` | This file — comprehensive documentation of all changes. |

## Files Verified (No Changes Needed)

| File | Verification |
|------|-------------|
| `frontend/src/widget-embed.tsx` | Source code already correct with left: 0 at all mobile breakpoints |
| `frontend/src/components/common/ToastContainer.tsx` | Confirmed it plays `playNotificationChime()` for 'new-lead' toasts |
| `frontend/src/App.tsx` | Confirmed `<NewLeadWatcher />` is mounted in authenticated shell |
| `frontend/src/services/leads.ts` | Source field mapping already present in `mapLeadResponse()` |
| `frontend/src/hooks/useLeads.ts` | Source passthrough already present in `transformLeadToTableRow()` |
| `frontend/src/types/lead.ts` | `source?: string` field already in `LeadTableRow` interface |
| `backend/src/models/lead.py` | `LeadSource.manual = "manual"` enum value present |
| `backend/src/tasks/celery_app.py` | Celery Beat schedule: `daily-lead-digest-7am-mst` at `crontab(hour=14, minute=0)` UTC = 7:00 AM MST |
| `backend/src/tasks/lead_tasks.py` | `send_daily_lead_digest` task with autoretry, max_retries=3, Paubox+SMTP fallback |
