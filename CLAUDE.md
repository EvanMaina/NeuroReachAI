# NeuroReach AI — Developer Reference (CLAUDE.md)

> Generated 2026-05-22. Update this file whenever a major architectural decision is made.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11 · FastAPI · SQLAlchemy (sync ORM) · PostgreSQL |
| **Frontend** | React 18 · TypeScript · Vite · TailwindCSS · Lucide icons |
| **Task queue** | Celery + Redis (Flower at port 5555) |
| **Cache** | Redis (custom `get_cache()` wrapper in `backend/src/services/cache.py`) |
| **Auth** | JWT (cookie + Bearer) via `backend/src/core/auth.py` |
| **Encryption** | AES-256 for all PHI via `EncryptionService` (`backend/src/services/encryption.py`) |
| **Dev containers** | Docker Compose (`docker-compose.yml`); prod variant is `docker-compose.prod.yml` |
| **Migrations** | Plain SQL files in `database/init/` — numbered `001_…` through `027_…`. New migrations go here. The migration runner tolerates already-exists errors on existing DBs. |

### Dev service ports (local)
| Service | Port |
|---|---|
| Backend API | 8000 |
| Frontend (Vite) | 5173 |
| MailDev (email catch) | 1080 |
| smsdev (SMS catch) | 1081 |
| Flower (Celery monitor) | 5555 |

---

## Repository Layout

```
NeuroReachAI/
├── backend/
│   ├── src/
│   │   ├── api/           # FastAPI routers (one file per domain)
│   │   ├── core/          # DB, auth, config
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic (scoring, encryption, audit, cache…)
│   │   ├── tasks/         # Celery tasks
│   │   └── main.py        # FastAPI app factory
│   ├── migrations/        # (empty placeholder — SQL lives in database/init/)
│   └── requirements.txt
├── database/
│   └── init/              # Numbered SQL migration files (001–027)
├── frontend/
│   └── src/
│       ├── components/dashboard/  # All coordinator UI components
│       ├── pages/                 # Top-level page components
│       ├── services/              # API client functions (leads.ts, attachments.ts…)
│       ├── types/                 # Shared TypeScript types (lead.ts, provider.ts…)
│       └── hooks/                 # Custom React hooks
└── docker-compose.yml
```

---

## Domain Models

### Lead (`backend/src/models/lead.py`)

The central model. All PHI columns are AES-256 encrypted (`*_encrypted` columns hold `LargeBinary`).

**Key enums (all stored as PostgreSQL ENUMs — changes require a migration):**

| Enum | Values | Notes |
|---|---|---|
| `LeadSource` | widget, jotform, google_ads, referral, manual, api, import | `manual` = coordinator-entered from dashboard |
| `LeadStatus` | NEW, CONTACTED, SCHEDULED, CONSULTATION_COMPLETE, TREATMENT_STARTED, LOST, DISQUALIFIED | Broad funnel stage |
| `ContactOutcome` | NEW, ANSWERED, NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED, SCHEDULED, COMPLETED, NOT_INTERESTED | Result of last coordinator action |
| `PriorityType` | HOT, MEDIUM, LOW, DISQUALIFIED | Calculated from scoring |
| `ConditionType` | DEPRESSION, ANXIETY, OCD, PTSD, OTHER | |
| `UrgencyType` | ASAP, WITHIN_30_DAYS, EXPLORING | |

**Important non-obvious columns:**
- `follow_up_reason` (Text) — human-readable tag set by outcome handlers: "No Answer", "No Show", "Rescheduled", "Cancelled Appointment", "Second Consult Required", "Not Interested", "Callback Requested". Used to route leads into sidebar queues.
- `last_updated_at` — manually stamped by `mark_lead_activity(lead)` on every coordinator action (NOT the ORM `updated_at`). Drives "Last Activity" sort.
- `is_referral` (Boolean) — OVERRIDES utm_source routing in all analytics when True → always maps to Referral platform card.
- `source` — set at creation; `manual` leads are excluded from source analytics by default.
- `completed_by_user_id` — populated from JWT when status moves to CONSULTATION_COMPLETE or TREATMENT_STARTED.
- `deleted_at` — soft-delete; all queries must filter `Lead.deleted_at.is_(None)`.

### LeadNote (`backend/src/models/lead_note.py`)
Per-lead notes with `note_type` (manual | outcome | system), `created_by_name`, and `related_outcome`.

### ReferringProvider (`backend/src/models/provider.py`)
Provider directory. Auto-created or matched when a referral lead arrives. Linked via `Lead.referring_provider_id`.

---

## Lead Lifecycle & Queue Logic

```
NEW (untouched)
  → contacted (any ContactOutcome ≠ NEW)
    → follow_up (NO_ANSWER | UNREACHABLE | CALLBACK_REQUESTED)
      → callback (CALLBACK_REQUESTED)
    → scheduled (ConsultationScheduled)
      → completed (CONSULTATION_COMPLETE / TREATMENT_STARTED)
      → no_show   → back to follow-up / re-schedule
      → cancelled → back to follow-up
    → unreachable
    → not_interested
```

**Queue sidebar filters** (`frontend/src/components/dashboard/QueueSidebar.tsx`):
- `new` → status=NEW AND contactOutcome=NEW
- `contacted` → contactOutcome ≠ NEW (inclusive — all contacted leads)
- `follow_up` → follow_up_reason IN ["No Answer", "Callback Requested", "Unreachable", "No Show", "Cancelled Appointment", …]
- `callback` → follow_up_reason = "Callback Requested"
- `scheduled` → contactOutcome = SCHEDULED
- `completed` → contactOutcome = COMPLETED
- `unreachable` → follow_up_reason = "Unreachable"
- `not_interested` → follow_up_reason = "Not Interested"

**Consultation outcomes** handled at `POST /api/leads/{id}/consultation-outcome`:

| `outcome` param | Status → | follow_up_reason | follow_up_date |
|---|---|---|---|
| complete | CONSULTATION_COMPLETE | — | — |
| reschedule | SCHEDULED | "Rescheduled" | user-selected |
| followup | CONTACTED | "Second Consult Required" | user-selected |
| no_show | CONTACTED | "No Show" | +1 day |
| cancelled | CONTACTED | "Cancelled Appointment" | +7 days |

---

## Analytics Architecture (`backend/src/api/source_analytics.py`)

### Platform cards
Four cards are always shown: **Widget · Google Ads · Jotform · Referral**

### Routing logic (in priority order)
1. `Lead.is_referral = True` → **Referral** (overrides all utm values)
2. `Lead.utm_source` mapped via `SOURCE_MAPPING` dict → platform
3. Default (no utm_source) → **Widget**

### Critical exclusion
All analytics queries currently filter: `Lead.source != LeadSource.manual`
This means ALL coordinator-entered leads are invisible to analytics today.

### Cache
All source-analytics endpoints are Redis-cached (30–60 s TTL via `get_cache()`). `cache.invalidate_on_lead_change()` is called after any lead mutation.

---

## Backend Conventions

### Authentication
- `Depends(get_current_user)` — any authenticated user
- `Depends(require_role("administrator", "coordinator"))` — role-gated

### PHI Encryption
All PHI fields (name, email, phone, DOB) go through `EncryptionService.encrypt_field()` before DB write and `EncryptionService.decrypt_field()` on read. Never store raw PHI.

### Lead Activity Stamping
Call `mark_lead_activity(lead)` before every `db.commit()` that modifies a lead. Failure to do so breaks "Last Activity" sort in the dashboard.

### Transition Field Clearing
Call `clear_lead_transition_fields(lead)` at the START of every queue transition to prevent stale `follow_up_reason` / `scheduled_callback_at` from carrying over.

### Soft Delete
Filter `Lead.deleted_at.is_(None)` in every query. Never hard-delete leads.

### Optimistic Locking
`ensure_expected_updated_at(lead, expected_updated_at, lead_id)` → raises HTTP 409 if another coordinator changed the lead since the client last fetched it.

### Lead Scoring
- Widget/Jotform submissions → `calculate_lead_score_v2()` (v2 scoring, full breakdown)
- Manual leads → hardcoded HOT priority, score=50 (neutral baseline)

### Lead Number Format
`TMS-YYYY-NNN` — generated by `generate_unique_lead_number(db)` in `backend/src/services/lead_number.py`.

---

## Database / Migration Rules

1. **New migrations** go in `database/init/` as `028_description.sql`, `029_…` etc.
2. Always wrap enum additions in `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN null; END $$;`
3. Always use `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
4. **Never** rename existing enum values — PostgreSQL requires a type replacement.
5. The migration runner (CI/CD) replays all files in order and tolerates already-exists errors.

---

## Frontend Conventions

### API calls
All requests go through `frontend/src/services/api.ts` (`apiClient` — Axios instance). Service files (`leads.ts`, `attachments.ts`, `providers.ts`) export typed async functions; components never call `apiClient` directly.

### Key components
| Component | Purpose |
|---|---|
| `ManualLeadModal.tsx` | "Add New Lead" modal — POST /api/leads/manual |
| `QueueSidebar.tsx` | Left sidebar queue navigation |
| `LeadsTable.tsx` | Lead list with inline actions |
| `LeadDetailModal.tsx` | Full lead detail view |
| `ContactOutcomeDropdown.tsx` | Inline outcome picker per lead |
| `ConsultationPanel.tsx` | Consultation outcome recording |
| `AnalyticsDashboard.tsx` | Source analytics page (calls /api/analytics/sources) |

### IManualLeadRequest (current fields)
`first_name` (required), `last_name`, `email`, `phone`, `condition`, `condition_other`, `symptom_duration`, `prior_treatments`, `has_insurance`, `insurance_provider`, `zip_code`, `urgency`, `notes`, `is_referral`, `referring_provider_name`, `referring_provider_contact`, `referring_provider_specialty`

---

## Pending Feature Work (this session)

### Feature A — Manual Lead Source Attribution
**Goal**: When coordinator adds a lead manually, let them select HOW the patient found the clinic (Google Ad, Google Search, Social Media, Friend/Word-of-mouth, Provider Referral, Other). Route that lead into the correct analytics platform card.

**Approach**:
- New DB column `manual_lead_source VARCHAR(50)` (nullable) on `leads` table → migration `028_add_manual_lead_source.sql`
- Update `ManualLeadCreate` schema + `IManualLeadRequest` + `create_manual_lead` endpoint
- Update source analytics to include manual leads that have `manual_lead_source` set (not just `source != manual`), mapping to the correct platform card
- Premium dropdown in `ManualLeadModal.tsx` with icons and descriptions per option

**Platform mapping**:
| manual_lead_source | Analytics card |
|---|---|
| google_ads | Google Ads |
| google_search | Widget (organic digital) |
| social_media | Referral (no dedicated card yet) |
| friend | Referral (set is_referral=True) |
| provider_referral | Referral (is_referral=True, triggers provider link) |
| other / null | Excluded (as today) |

### Feature B — No-Show / Post-Consultation Queue
**Goal**: A premium new queue between Scheduled and Completed that captures leads who had a scheduled consultation but didn't show up, with reason tracking for process improvement.

**Approach**:
- New `ContactOutcome` value: `NO_SHOW` → migration `029_add_no_show_outcome.sql`
- New `no_show_reason VARCHAR(255)` (nullable) column on leads → same migration
- Update `no_show` outcome handler in leads API to set `contact_outcome = NO_SHOW` (instead of ANSWERED)
- New `no_show` queue type in `QueueSidebar.tsx`
- Dedicated "No Show" panel with reason display, re-schedule and re-engage quick actions
- No-show reason dropdown: Patient Cancelled (wants reschedule) / Patient Cancelled (not interested) / No Call / No Show / Insurance Issue / Transportation Issue / Provider Unavailable / Other

---

## Key File Reference

| File | What it does |
|---|---|
| `backend/src/models/lead.py` | All enums + Lead SQLAlchemy model |
| `backend/src/schemas/lead.py` | Pydantic schemas (ManualLeadCreate line 1011) |
| `backend/src/api/leads.py` | All lead endpoints (manual create ~1419, consultation-outcome ~2680) |
| `backend/src/api/source_analytics.py` | Platform analytics (exclusion filter line 299) |
| `database/init/007_add_source_column.sql` | lead_source enum definition |
| `database/init/002_contact_outcomes.sql` | contact_outcome_type enum definition |
| `frontend/src/components/dashboard/ManualLeadModal.tsx` | Add Lead modal |
| `frontend/src/components/dashboard/QueueSidebar.tsx` | Queue navigation (QueueType line 46) |
| `frontend/src/services/leads.ts` | IManualLeadRequest (line 168), createManualLead (line 206) |
| `frontend/src/types/lead.ts` | ContactOutcome type (line 29), CONTACT_OUTCOME_CONFIG (line 43) |
