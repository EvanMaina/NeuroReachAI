# STEP 0H — PRE-FLIGHT REPORT
## NeuroReach-AI Production Deployment Audit
### Generated: 2026-03-04

---

## EXECUTIVE SUMMARY

| Category | Status |
|----------|--------|
| 0A — Environment Variables | ⚠️ ACTION REQUIRED |
| 0B — User Model & Auth | ⚠️ ACTION REQUIRED |
| 0C — Complete Lead Flow | ✅ ALL CLEAR |
| 0D — Widget & Assessment URLs | ✅ ALL CLEAR |
| 0E — Communications | ⚠️ ACTION REQUIRED |
| 0F — Database & Migrations | ⚠️ ACTION REQUIRED |
| 0G — CORS & Security | ⚠️ ACTION REQUIRED |

**VERDICT: 5 ACTION REQUIRED items must be resolved before proceeding to Step 1.**

---

## 0A — ENVIRONMENT VARIABLES

### ✅ ALL CLEAR Items
- `DATABASE_URL` — Set correctly, points to RDS (`neuroreach-ai-db.cfggkciq6tun.us-east-2.rds.amazonaws.com`)
- `REDIS_URL` — Set correctly, uses `rediss://` (TLS) to ElastiCache
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` — Set correctly with `?ssl_cert_reqs=CERT_NONE`
- `ENVIRONMENT` — Set to `"production"` ✅
- `EMAIL_MODE` — Set to `"paubox"` ✅
- `SMS_MODE` — Set to `"twilio"` ✅
- `SECRET_KEY` — Set to production value (not dev default) ✅
- `ELASTICSEARCH_ENABLED` — Set to `"false"` ✅
- `TWILIO_*` — All 3 vars set (SID, token, phone) ✅
- `PAUBOX_*` — All 5 vars set ✅
- `CALLRAIL_*` — All 3 vars set ✅
- `GOOGLE_ADS_WEBHOOK_KEY` — Set ✅
- `EMAIL_LOGO_URL` — Set in backend task def ✅

### ⚠️ ACTION REQUIRED

#### CRITICAL — `ENCRYPTION_KEY` Not Set in Task Definitions
- **Issue**: Neither `backend-task-def.json` nor `celery-task-def.json` includes `ENCRYPTION_KEY`.
- **Impact**: Config defaults to `"dev-encryption-key-32bytes!"`. In `main.py` lifespan, the production safety check detects this and calls `sys.exit(1)`, which means **the backend is crashing on every startup attempt**.
- **Code Reference** (`backend/src/main.py`):
  ```python
  if settings.encryption_key.rstrip("0") == "dev-encryption-key-32bytes!":
      _insecure_secrets.append("ENCRYPTION_KEY")
  if _insecure_secrets and settings.is_production:
      sys.exit(1)  # FATAL: refuses to start
  ```
- **Fix**: Generate a strong ENCRYPTION_KEY (32+ chars) and add to BOTH task definitions:
  ```json
  {"name": "ENCRYPTION_KEY", "value": "<generated-strong-key>"}
  ```

#### INFO — `JWT_SECRET` is Unused (Dead Env Var)
- **Issue**: Both task defs set `JWT_SECRET`, but `config.py` has no `jwt_secret` field. JWT signing uses `SECRET_KEY` via `settings.secret_key`.
- **Impact**: No functional impact — just a dead env var.
- **Recommendation**: Remove `JWT_SECRET` from task defs for cleanliness, or leave as-is (no harm).

---

## 0B — USER MODEL & AUTH

### ✅ ALL CLEAR Items
- JWT auth flow works with `SECRET_KEY` (HS256 algorithm via `python-jose`)
- Password hashing uses bcrypt directly — confirmed in `security.py`
- Login endpoint at `POST /api/auth/login` — verified
- Role hierarchy in `auth.py`: `primary_admin` implies `administrator` permissions

### ⚠️ ACTION REQUIRED

#### Step 3 Correction — Role Value is `"administrator"` NOT `"admin"`
- **Issue**: User's Step 3 specifies `role=admin` for User 2, but the `UserRole` enum values are:
  ```python
  class UserRole(str, Enum):
      PRIMARY_ADMIN = "primary_admin"
      ADMINISTRATOR = "administrator"  # NOT "admin"
      COORDINATOR = "coordinator"
      SPECIALIST = "specialist"
  ```
- **Fix**: Use `role=administrator` (not `admin`) when creating User 2.

#### Step 3 Correction — `setup_fresh_admin.py` Deletes ALL Users
- **Issue**: The existing script (`backend/scripts/setup_fresh_admin.py`) runs `DELETE FROM users` before creating the new user. Running it twice (for two users) would delete User 1 when creating User 2.
- **Fix**: For Step 3, we will create a **custom script** (`create_production_users.py`) that:
  - Uses `INSERT ... ON CONFLICT (email) DO UPDATE` (upsert)
  - Does NOT delete existing users
  - Creates both users in a single run
  - Uses the specified passwords (`TMS@2025!Change`) with bcrypt hashing

---

## 0C — COMPLETE LEAD FLOW

### ✅ ALL CLEAR
- **Widget intake** (`/api/widget/submit`) → creates lead → queues Celery tasks for emails/SMS ✅
- **JotForm webhook** (`/api/webhooks/jotform`) → processes form, creates lead, queues tasks ✅
- **Google Ads webhook** (`/api/webhooks/google-ads`) → validates key, creates lead, queues tasks ✅
- Both webhooks have **idempotency** protection (submissionID / lead_id checks) ✅
- Lead scoring (`lead_scoring_v2.py`) runs inline during creation ✅
- Celery tasks (`lead_tasks.py`) handle async email confirmations and SMS ✅

---

## 0D — WIDGET & ASSESSMENT URLs

### ✅ ALL CLEAR
- `_get_external_base_url()` in `widget.py` reads `X-Forwarded-Proto` and `X-Forwarded-Host` headers — **will work correctly behind ALB** ✅
- Widget routes: `/widget-embed.js`, `/assessment`, `/assessment-bundle.js` — all served from backend ✅
- Frontend nginx config allows iframe embedding on widget route ✅
- No hardcoded localhost URLs in widget/assessment serving code ✅

---

## 0E — COMMUNICATIONS

### ✅ ALL CLEAR Items
- **Email (Paubox)**: `EMAIL_MODE=paubox` with SMTP fallback — configured correctly ✅
- **SMS (Twilio)**: `SMS_MODE=twilio` with all credentials set ✅
- **Email templates**: All use `get_logo_url()` which reads `EMAIL_LOGO_URL` env var ✅

### ⚠️ ACTION REQUIRED

#### Celery Task Def Missing `EMAIL_LOGO_URL`
- **Issue**: `celery-task-def.json` does NOT include `EMAIL_LOGO_URL`. Celery workers execute email-sending tasks (confirmations, notifications). When the Celery worker process imports `email_base.py` and calls `get_logo_url()`, it will use the default value `http://localhost:8000/static/images/logo.png`.
- **Impact**: All emails sent by Celery workers will have a broken logo image (pointing to localhost).
- **Fix**: Add to `celery-task-def.json`:
  ```json
  {"name": "EMAIL_LOGO_URL", "value": "https://api.tmsinstitute.co/static/images/logo.png"}
  ```

#### Celery Task Def Missing `GOOGLE_ADS_WEBHOOK_KEY`
- **Issue**: Not in celery task def. If any Celery task ever references this setting, it would use the default.
- **Impact**: Low risk — webhook validation happens in the API endpoint (backend), not in Celery tasks.
- **Recommendation**: Add for consistency, but not a blocker.

---

## 0F — DATABASE & MIGRATIONS

### ⚠️ ACTION REQUIRED

#### No Alembic Found — Step 2 Will Fail
- **Issue**: Search for "alembic" across the entire codebase returned **0 results**. There is no `alembic.ini`, no `alembic/` directory, no migration scripts. The project uses **raw SQL init scripts** in `database/init/` (files 001 through 023).
- **Impact**: Step 2's command `alembic upgrade head` will fail with "command not found".
- **Fix Options**:
  1. **Option A (Recommended)**: Run the SQL init scripts directly against RDS using `psql` or an ECS one-time task with a custom command. The SQL files use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc., so they are **idempotent** and safe to re-run.
  2. **Option B**: Skip Step 2 entirely if the database was already initialized with these scripts during initial RDS setup.
- **Question for user**: Was the RDS database already initialized with these SQL scripts, or does it need to be set up from scratch?

---

## 0G — CORS & SECURITY

### ✅ ALL CLEAR Items
- CORS configured from `settings.cors_origins_list` (comma-separated string parsed to list) ✅
- Production safety checks in `main.py` lifespan — blocks dev-default secrets ✅
- Swagger docs disabled in production (`settings.is_production`) ✅
- Static files mounted at `/static` for logo serving ✅

### ⚠️ ACTION REQUIRED

#### CORS_ORIGINS Needs Two Additional Origins
- **Current** (in backend-task-def.json): `https://app.tmsinstitute.co,https://www.tmsinstitute.co`
- **Required** (per Step 1): `https://app.tmsinstitute.co,https://api.tmsinstitute.co,https://tmsinstitute.co,https://www.tmsinstitute.co`
- **Missing**: `https://api.tmsinstitute.co` and `https://tmsinstitute.co` (bare domain)
- **Fix**: Will be addressed in Step 1.

---

## COMPLETE ACTION ITEMS SUMMARY

| # | Severity | Item | Fix |
|---|----------|------|-----|
| 1 | 🔴 CRITICAL | `ENCRYPTION_KEY` missing from both task defs | Generate strong key, add to both backend + celery task defs |
| 2 | 🔴 CRITICAL | No Alembic in codebase — Step 2 command will fail | Use SQL init scripts against RDS, or confirm DB already initialized |
| 3 | 🟡 IMPORTANT | `EMAIL_LOGO_URL` missing from celery task def | Add to celery-task-def.json |
| 4 | 🟡 IMPORTANT | Step 3 role value must be `"administrator"` not `"admin"` | Noted — will use correct value |
| 5 | 🟡 IMPORTANT | `setup_fresh_admin.py` deletes all users | Create custom script for Step 3 |
| 6 | 🟡 MODERATE | CORS_ORIGINS needs 2 additional origins | Will fix in Step 1 |
| 7 | 🔵 INFO | `JWT_SECRET` is dead env var | Optional cleanup |
| 8 | 🔵 INFO | `GOOGLE_ADS_WEBHOOK_KEY` missing from celery task def | Optional — add for consistency |

---

## PROPOSED REVISED PLAN

Based on findings, here is the corrected execution plan:

### Step 1 — Update Task Definitions (REVISED)
Update **both** backend AND celery task defs with:
- `ENCRYPTION_KEY` = `<generate-64-char-hex-key>` (NEW — both task defs)
- `CORS_ORIGINS` = `https://app.tmsinstitute.co,https://api.tmsinstitute.co,https://tmsinstitute.co,https://www.tmsinstitute.co` (backend only)
- `EMAIL_LOGO_URL` = `https://api.tmsinstitute.co/static/images/logo.png` (celery — already set in backend)
- Optionally remove `JWT_SECRET` (dead var)

### Step 2 — Database Setup (REVISED)
- **If DB already initialized**: Skip this step
- **If DB needs setup**: Run SQL init scripts (001-023) against RDS via one-time ECS task or direct psql connection

### Step 3 — Create Production Admin Users (REVISED)
- Create custom `create_production_users.py` script (no DELETE)
- Use `role="primary_admin"` for User 1, `role="administrator"` for User 2
- Use `password="TMS@2025!Change"` with bcrypt hashing
- Run as one-time ECS task

### Steps 4-5 — Unchanged
- Redeploy backend + celery services
- Verify health, users, routes

---

**⏸️ AWAITING USER CONFIRMATION before proceeding to Step 1.**

Please confirm:
1. Do you approve the revised plan above?
2. Was the RDS database already initialized with the SQL scripts, or does it need setup?
3. Should I generate the ENCRYPTION_KEY for you?
