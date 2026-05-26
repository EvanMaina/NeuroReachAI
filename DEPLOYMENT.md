# NeuroReach AI — Deployment Reference

> Last updated: 2026-05-26. Update this file whenever the pipeline changes.

---

## Overview

NeuroReach AI uses a **fully automatic, one-push CI/CD pipeline** on GitHub Actions, deploying to AWS ECS (Fargate).

**The developer workflow is:**

```
Make changes locally → push to dev → everything happens automatically
```

One push to `dev` triggers CI, staging deploy, and production deploy — no manual steps after the push.

---

## Environments

| Environment | URL | Branch | ECS Cluster |
|---|---|---|---|
| Production | https://app.tmsinstitute.co | `main` | `neuroreach-ai-cluster` |
| Staging | https://app-staging.tmsinstitute.co | `staging` | `neuroreach-ai-cluster` |
| Local Dev | http://localhost:5173 | — | Docker Compose |

---

## Pipeline Architecture

```
Developer pushes to dev
        │
        ▼
┌──────────────────────────────┐
│         CI Workflow           │  .github/workflows/ci.yml
│  Runs on every push to dev   │
│  and on all pull requests     │
└─────────────┬────────────────┘
              │ Critical checks pass?
              ▼
┌──────────────────────────────┐
│    Promote & Deploy All       │  .github/workflows/promote.yml
│    (auto-triggered by CI)     │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
  dev → staging    staging → main
       │               │
       ▼               ▼
 Deploy Staging    Deploy Production
  (ECS Fargate)    (ECS Fargate)
```

---

## Step 1 — CI Checks (`.github/workflows/ci.yml`)

Runs on every push to `dev` and on every pull request.

### Checks

| Check | Tool | Blocks deployment? |
|---|---|---|
| Backend lint | Flake8 (max line 120) | No — advisory |
| Backend type check | MyPy | No — advisory |
| Backend unit tests | Pytest (SQLite in-memory) | No — advisory |
| Frontend lint | ESLint | No — advisory |
| **Frontend type check** | **TypeScript `tsc --noEmit`** | **Yes** |
| **Frontend build** | **Vite (`npm run build` + widget + assessment)** | **Yes** |
| Frontend tests | Vitest | No — advisory |
| CVE scan | Trivy (CRITICAL/HIGH) | No — advisory |
| Secret scan | Gitleaks | No — advisory |
| **Backend Docker build** | `docker build --target production` | **Yes** |
| Changelog check | Git diff on CHANGELOG.md | No — advisory |

**CI passes if and only if `tsc`, `npm run build`, and `docker build` all succeed.**
All other failures appear in the summary but do not block the promotion.

---

## Step 2 — Promote & Deploy (`.github/workflows/promote.yml`)

**Auto-triggers** when CI completes with `success` on the `dev` branch.
Can also be **manually triggered**: GitHub → Actions → "Promote & Deploy All Environments" → Run workflow.

### Sequence

| Step | What happens |
|---|---|
| **Gate** | Confirms CI passed (or manual trigger). Exits early otherwise. |
| **Merge dev → staging** | Checks out `staging`, merges `origin/dev`, pushes. |
| **Deploy Staging** | Calls `deploy-staging.yml` as a reusable workflow (full build + deploy). |
| **Merge staging → main** | Runs in parallel with staging deploy. Merges `origin/staging` into `main`, pushes. |
| **Deploy Production** | Calls `deploy-production.yml` with `skip_ci: true` (CI already ran on dev). |

---

## Step 3 — Build & Deploy (both environments)

`deploy-staging.yml` and `deploy-production.yml` follow the same steps.
Differences: ECS service/task names, image tag prefixes (`staging-` vs `prod-`), and target URLs.

### 3.1 Repo Identity Guard *(production only)*
`scripts/verify_repo_identity.sh` confirms the codebase is NeuroReach AI.
Deployment aborts if another product's markers are detected (cross-contamination guard).

### 3.2 AWS Authentication
```
aws-actions/configure-aws-credentials
  AWS_ACCESS_KEY_ID     → GitHub secret
  AWS_SECRET_ACCESS_KEY → GitHub secret
  Region: us-east-2
  ECR Registry: 131880217305.dkr.ecr.us-east-2.amazonaws.com
```

### 3.3 Build Frontend Bundles
```bash
cd frontend
npm ci
npm run build           # Main React SPA      → frontend/dist/
npm run build:widget    # Embeddable widget   → frontend/dist-widget/
npm run build:assessment # Assessment flow    → frontend/dist-assessment/
```
`VITE_API_URL` is injected at build time (e.g. `https://app.tmsinstitute.co`).

Bundles are copied into `backend/frontend-bundles/` so the backend Docker image can serve them as static files.

### 3.4 Copy SQL Migrations into Docker Context
```bash
cp database/init/*.sql backend/migrations/
```
All numbered SQL files (`001_…sql` through latest) are placed inside the Docker build context so `run_migrations.py` finds them at `/app/migrations/` inside the container.

### 3.5 Build Backend Docker Image
```bash
docker build \
  --target production \
  --tag <ecr>/neuroreach-ai/backend:prod-<sha7> \
  --tag <ecr>/neuroreach-ai/backend:prod-latest \
  --file backend/Dockerfile backend/
```
Tagged with an immutable SHA tag (`prod-<sha7>`) and a rolling `prod-latest` tag.

### 3.6 CVE Scan
Trivy scans the built image for CRITICAL CVEs. Non-blocking — results appear in the workflow summary.

### 3.7 Push Image to ECR
Three tags pushed: `prod-<sha7>`, `prod-latest`, `latest`.

### 3.8 Run Database Migrations *(before deploying new backend code)*

**This is the most critical step. Migrations run before new application code goes live, guaranteeing the schema is ready.**

1. A new ECS task definition revision is registered using the freshly-pushed image.
2. A one-off Fargate task runs with the command override:
   ```
   python /app/scripts/run_migrations.py
   ```
3. The script reads `*.sql` files from `/app/migrations/`, checks a `schema_migrations` table, and applies only files not yet applied. Already-applied files are skipped — re-running is always safe.
4. The pipeline polls every 10 seconds, up to 5 minutes.
5. **If the migration task exits non-zero, the entire deployment is aborted immediately.** The running production backend continues on the old schema — no broken intermediate state.

### 3.9 Deploy Backend ECS Service
- Downloads current task definition JSON from ECS
- Renders a new revision with the updated image tag
- Deploys via `aws-actions/amazon-ecs-deploy-task-definition` with `wait-for-service-stability: true` (15-minute timeout)
- ECS rolling update: new tasks start → health checks pass → old tasks terminate

### 3.10 Deploy Celery Worker ECS Service
Same process as 3.9. Uses the same Docker image, different ECS service (`neuroreach-ai-celery-service`) and task definition (`neuroreach-ai-celery`).

**Celery runs with embedded Beat** (`celery worker -B`). After deploy, the pipeline enforces `desiredCount=1` to prevent duplicate scheduled tasks (emails/SMS firing twice).

### 3.11 Build & Deploy Frontend Docker Image
```bash
docker build --target production --file frontend/Dockerfile frontend/
```
Pushed to ECR as `neuroreach-ai/frontend:prod-<sha7>`, then deployed to `neuroreach-ai-frontend-service` (nginx container serving the React SPA).

### 3.12 Smoke Tests
After services stabilise, the pipeline curls the ALB directly:
- `GET /health/live` with `Host: app.tmsinstitute.co` header — must return 200
- `GET /health` — full health check
- `GET https://app.tmsinstitute.co/health/live` via custom domain — non-blocking

ALB DNS: `neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com`

### 3.13 Post-Deploy Identity Verification *(production only)*
Fetches `https://app.tmsinstitute.co/` and checks that the HTML `<title>` contains "NeuroReach". Retries up to 6 times over 60 seconds. Fails the pipeline if the wrong product is live.

### 3.14 Git Release Tag *(production only)*
Creates an annotated tag on `main`:
```
deploy-prod-<sha7>-<YYYYMMDD-HHMMSS>
```
Every production deployment is permanently traceable in git history.

---

## AWS Infrastructure

| Resource | Name |
|---|---|
| ECS Cluster | `neuroreach-ai-cluster` |
| Prod backend service | `neuroreach-ai-backend-service` |
| Prod celery service | `neuroreach-ai-celery-service` |
| Prod frontend service | `neuroreach-ai-frontend-service` |
| Staging backend service | `neuroreach-staging-backend-service` |
| Staging celery service | `neuroreach-staging-celery-service` |
| Staging frontend service | `neuroreach-staging-frontend-service` |
| Prod backend task def | `neuroreach-ai-backend` |
| Prod celery task def | `neuroreach-ai-celery` |
| Prod frontend task def | `neuroreach-ai-frontend` |
| ECR backend repo | `neuroreach-ai/backend` |
| ECR frontend repo | `neuroreach-ai/frontend` |
| ALB DNS | `neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com` |
| AWS Region | `us-east-2` |
| AWS Account ID | `131880217305` |

---

## Required GitHub Secrets

Configure in **GitHub → Settings → Secrets and Variables → Actions** (repository level):

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | ECR push + ECS deploy authentication |
| `AWS_SECRET_ACCESS_KEY` | ECR push + ECS deploy authentication |
| `GITLEAKS_LICENSE` | Gitleaks secret scanning (optional) |

GitHub Environments (`production`, `staging`) can be configured in **Settings → Environments** to add a manual approval gate before each deploy runs.

---

## Rollback (`.github/workflows/rollback.yml`)

If production breaks after a deploy, roll back without reverting code.

**Trigger**: GitHub → Actions → "Rollback Production" → Run workflow

| Input | Options | Notes |
|---|---|---|
| `rollback_type` | `previous-task-definition` / `specific-image-tag` | `previous-task-definition` is the safe default |
| `image_tag` | e.g. `prod-18513d3` | Only for `specific-image-tag` |
| `services` | `both` / `backend-only` / `celery-only` | |
| `confirm` | Must type `ROLLBACK` | Safety gate |

Previous image tags are visible in AWS ECR. Git release tags (`deploy-prod-*`) map each SHA to its deploy timestamp.

---

## Database Migration Rules

1. New files go in `database/init/` as `030_description.sql`, `031_…`, etc.
2. Wrap all enum additions:
   ```sql
   DO $$ BEGIN
     ALTER TYPE my_enum ADD VALUE 'new_value';
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   ```
3. Always use `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
4. Never rename existing enum values — PostgreSQL requires a full type replacement.
5. Push to `dev` — the migration runner applies the new file automatically before the new backend goes live.

The migration runner (`backend/scripts/run_migrations.py`) tracks applied files in a `schema_migrations` table. Re-running on an existing database is always safe.

---

## Moving the Repository to an Enterprise GitHub Account

### Option A — GitHub Transfer (recommended)

Keeps full commit history, all branches, tags, Issues, and Pull Requests. The old URL redirects for a period.

1. Current repo → **Settings → Danger Zone → Transfer repository**
2. Enter the destination org (e.g. `tmsinstitute`)
3. Confirm with your GitHub password

**After transfer:**

4. Add GitHub secrets in the new repo — Settings → Secrets → Actions:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
5. Re-create GitHub Environments (`production`, `staging`) in Settings → Environments if you use approval gates
6. Update your local clone:
   ```bash
   git remote set-url origin https://github.com/tmsinstitute/NeuroReachAI.git
   ```
7. `secrets.GITHUB_TOKEN` is auto-provisioned by GitHub — no change needed
8. **No AWS changes required** — the pipeline authenticates with IAM keys, not GitHub identity

### Option B — Manual mirror (if transfer is not available)

```bash
# 1. Clone everything — all branches and tags
git clone --mirror https://github.com/<old-account>/NeuroReachAI.git neuroreach-mirror
cd neuroreach-mirror

# 2. Create the new empty repo on GitHub first, then push
git remote set-url origin https://github.com/tmsinstitute/NeuroReachAI.git
git push --mirror

# 3. Update your local checkout
cd /path/to/local/checkout
git remote set-url origin https://github.com/tmsinstitute/NeuroReachAI.git
git fetch --all
```

Then follow steps 4–8 from Option A.

---

## Health Check Endpoints

| Endpoint | Purpose | Used by |
|---|---|---|
| `GET /health/live` | API process alive | ALB liveness, smoke tests |
| `GET /health` | API + DB connectivity | ALB health check, smoke tests |

---

## Local Development

```bash
# Start all services
docker compose up -d

# Watch logs
docker compose logs -f backend
docker compose logs -f celery

# Apply a migration manually to local DB
docker exec neuroreach-postgres psql -U postgres -d neuroreach_db \
  -f /docker-entrypoint-initdb.d/030_description.sql

# Restart backend + frontend together (fixes Docker DNS cache after restart)
docker restart neuroreach-backend neuroreach-frontend
```

Local service ports:

| Service | Port |
|---|---|
| Frontend (Vite) | 5173 |
| Backend API | 8000 |
| MailDev (email catch) | 1080 |
| smsdev (SMS catch) | 1081 |
| Flower (Celery monitor) | 5555 |

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Frontend returns stale data after backend restart | Docker DNS cache — Node.js caches DNS for process lifetime | `docker restart neuroreach-backend neuroreach-frontend` |
| Migration fails in CI | Bare `ALTER TYPE` instead of `DO $$ BEGIN … EXCEPTION $$` | Wrap enum additions — see migration rules above |
| Celery sends duplicate emails/SMS | More than 1 Celery replica running | Pipeline enforces `desiredCount=1`; check ECS service console manually |
| Production health check fails post-deploy | New code crashes on startup | Check CloudWatch Logs for `/ecs/neuroreach-ai-backend`; rollback via rollback workflow |
| `tsc` fails in CI | TypeScript error in frontend | Run `npm run type-check` locally before pushing to `dev` |
| Promote workflow does not auto-trigger | CI on `dev` did not finish with `conclusion == success` | Check the CI run in the Actions tab; fix the failing check and re-push |
