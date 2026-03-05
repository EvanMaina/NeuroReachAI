# 🚀 NeuroReach AI — Comprehensive Production Deployment Plan

**Date:** 2026-03-05  
**Author:** Deployment Engineering  
**Status:** IN PROGRESS  

---

## Table of Contents

1. [Current State Summary](#current-state-summary)
2. [Phase 1: Fix Celery (Redis)](#phase-1-fix-celery-option-a--re-provision-elasticache)
3. [Phase 2: Code Cleanup & Secret Hygiene](#phase-2-code-cleanup--secret-hygiene)
4. [Phase 3: Docker Hardening](#phase-3-docker-hardening)
5. [Phase 4: Git Branch Strategy & Cleanup](#phase-4-git-branch-strategy--cleanup)
6. [Phase 5: CI/CD Pipeline (GitHub Actions)](#phase-5-cicd-pipeline-github-actions)
7. [Phase 6: High Availability & Zero Downtime](#phase-6-high-availability--zero-downtime)
8. [Phase 7: Backups & Disaster Recovery](#phase-7-backups--disaster-recovery)
9. [Phase 8: Monitoring & Alerting](#phase-8-monitoring--alerting-prometheus--grafana)
10. [Phase 9: Staging Environment Setup](#phase-9-staging-environment-setup)
11. [Phase 10: Documentation](#phase-10-documentation)
12. [Input Required from Owner](#summary-of-what-i-need-from-you)
13. [Execution Order & Estimates](#execution-order)

---

## Current State Summary

Based on analysis performed 2026-03-05:

| Aspect | Current State | Issue |
|--------|---------------|-------|
| **Current branch** | `Production` | Uncommitted changes + untracked files |
| **Branches** | 14 branches | Many stale/old: `Evan-dev`, `Evan-dev-version-2`, etc. |
| **`main` branch** | 4 commits behind `Production` | Missing syncfix, code audit, deployment changes |
| **`staging` remote** | Only initial commit | Essentially empty |
| **Celery** | ❌ Broken | ElastiCache cluster mode causes CROSSSLOT errors |
| **Docker compose** | Uses `latest` tags | Dev services mixed in, no separate prod compose |
| **Console.log (FE)** | 26 occurrences | 2 unguarded in `App.tsx`, 24 dev-guarded |
| **Print statements (BE)** | 45 occurrences | Should be converted to proper `logger` calls |
| **CI/CD** | None | Manual docker build + push to ECR |
| **Backups** | None | No automated RDS snapshots or S3 log archival |
| **Monitoring** | Basic CloudWatch logs only | No alarms, dashboards, or alerting |
| **Load Balancing** | Single instance (desired=1) | No redundancy, single point of failure |
| **Backend `.dockerignore`** | Missing | Build context includes unnecessary files |
| **Secrets** | Visible in docs | Admin password, AWS account ID, API keys in committed files |

---

## Phase 1: Fix Celery (Option A — Re-provision ElastiCache)

**Estimated time:** 1-2 hours  
**Requires:** YOUR action on AWS Console

### What needs to happen:

1. **You (AWS Console):** Create a new ElastiCache Redis instance in **non-cluster mode** (single-node or replication group with cluster mode disabled)
   - Engine: Redis 7.x
   - Node type: `cache.t3.micro` or `cache.t3.small`
   - Cluster mode: **DISABLED**
   - TLS: Enabled
   - Same VPC/security group as current
   - Name suggestion: `neuroreach-redis-single`

2. **We will:** Update the Celery app config to properly work with the new Redis
3. **We will:** Revert the sync notification workaround — restore proper Celery `.delay()` calls
4. **We will:** Keep `sync_notifications.py` as a fallback with a feature flag (`USE_CELERY_ASYNC=true/false`)
5. **We will:** Update task definitions with the new Redis endpoint
6. **Deploy & verify** Celery worker connects and processes tasks

### 🔴 Input needed:
- New ElastiCache Redis endpoint after creation (non-cluster mode)
- Or confirm whether to use AWS CLI to provision it

---

## Phase 2: Code Cleanup & Secret Hygiene

**Estimated time:** 2-3 hours

### 2.1 Remove Debug Statements

- **Frontend:** Remove 2 unguarded `console.log` in `App.tsx`. The other 24 are already wrapped in `import.meta.env.DEV` (they tree-shake out in production build — safe to keep).
- **Backend:** Convert 45 `print()` statements to proper `logger.info()` / `logger.warning()` calls (especially in `main.py` — 30 prints and `db_health_check.py` — 15 prints).

### 2.2 Secrets Cleanup

- **Scrub `AWS_DEPLOYMENT_STATUS.md`:** Remove admin password, AWS account ID, Twilio SID, Paubox API details — replace with `[REDACTED]` or move to a private ops wiki
- **Create `.env.example` files** with placeholder values for both backend and frontend
- **Future:** AWS Secrets Manager or SSM Parameter Store for production secrets (instead of ECS task def plaintext env vars)

### 2.3 Remove Unnecessary Files from Staging/Main

Files that should NOT be in staging/main:

| File | Reason |
|------|--------|
| `test_paubox.py`, `test_twilio.py`, `test_twilio_direct.py` | Test scripts with credentials |
| `gen_taskdefs.py`, `fetch_logs.py` | Deployment helper scripts |
| `backend-task-def.json`, `celery-task-def.json`, `*-overrides.json` | ECS task defs with secrets |
| `*-containers.json`, `*-taskdef-updated.json`, `syncfix-taskdef.json` | Task def artifacts |
| `leads_response.json`, `login_resp.json` | Test response dumps |
| `docs/STEP0_PREFLIGHT_REPORT.md` | Deployment build docs |
| `docs/PRODUCTION_AUDIT_REPORT_v3.md`, `v4.md` | Deployment build docs |
| `docs/AWS_DEPLOYMENT_STATUS.md` | Contains secrets, move to private wiki |
| `backend/frontend-bundles/` | Build artifacts (generated in CI) |

---

## Phase 3: Docker Hardening

**Estimated time:** 2-3 hours

### 3.1 Pin All Image Versions

| Current (bad) | Pinned |
|---------------|--------|
| `postgres:14-alpine` | `postgres:14.15-alpine` |
| `redis:7-alpine` | `redis:7.4-alpine` |
| `node:20-alpine` | `node:20.18-alpine` |
| `python:3.11-slim` | `python:3.11.11-slim` |
| `nginx:alpine` | `nginx:1.27-alpine` |
| `maildev/maildev:latest` | `maildev/maildev:2.1.0` |
| `elasticsearch:8.12.0` | ✅ Already pinned |

### 3.2 Create `docker-compose.prod.yml`

Production compose file:
- **Remove:** `maildev`, `smsdev`, `flower`, `elasticsearch` (disabled in prod)
- **Remove:** Dev volume mounts (`:ro` source mounts)
- **Add:** Proper Docker networks (frontend/backend/data tiers)
- **Add:** Restart policies, resource limits tuned for production
- **Add:** Image tags instead of build contexts

### 3.3 Create `docker-compose.dev.yml` (override)

Dev-only compose:
- Keep dev services (maildev, smsdev, flower)
- Dev volume mounts for hot-reload
- Dev environment overrides

### 3.4 Create `.dockerignore` for Backend

```
__pycache__
*.pyc
.env*
.git
tests/
docs/
```

### 3.5 Docker Network Isolation

```yaml
networks:
  frontend:    # ALB → frontend, frontend → backend
  backend:     # backend → db, backend → redis, backend → celery
  data:        # db, redis (internal only)
```

---

## Phase 4: Git Branch Strategy & Cleanup

**Estimated time:** 2-3 hours

### 4.1 Branch Structure

```
main (production) ──→ deploys to production AWS (api.tmsinstitute.co)
  ↑ PR only
staging ──→ deploys to staging AWS (api-staging.tmsinstitute.co)
  ↑ PR only
dev ──→ local development (no auto-deploy)
  ↑ feature branches
```

### 4.2 Steps

1. **Commit all current changes** on `Production` branch (with proper message)
2. **Merge `Production` → `dev`** (dev becomes the source of truth with all latest code)
3. **Reset `staging`** to match `dev` (clean, with all code changes)
4. **Reset `main`** to match `staging` (production-ready code)
5. **Delete stale branches:** `Evan-dev`, `Evan-dev-version-2`, `CallRail-and-Widget`, `Evan-Jotforms-Feature`, `Evan-call-rail`, `Tested-Jotform-Dev`, `dev-version-2`, `ProdPrep`, `Pre-Production`, `Production`, `feature/*`
6. **Protect `main` and `staging`** on GitHub (require PRs, no force push)
7. **Update `.gitignore`** to exclude all deployment artifacts, task defs, env files, test scripts, response dumps

### 4.3 CHANGELOG.md

- Create `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format
- Enforce changelog updates in PRs via CI check

### 🔴 Input needed:
- Confirm OK to delete all old stale branches
- Branch protection rules: set up via GitHub API or manually?

---

## Phase 5: CI/CD Pipeline (GitHub Actions)

**Estimated time:** 4-5 hours

### 5.1 Workflows to Create

#### `.github/workflows/ci.yml` — Runs on ALL PRs

```
- Lint (ESLint + Flake8)
- Type check (TypeScript + MyPy)
- Unit tests (Vitest + Pytest)
- Security scan (Trivy for dependencies)
- Docker image build (no push — just verify it builds)
- Changelog check (ensure CHANGELOG.md updated)
- Secret scan (gitleaks/trufflehog)
```

#### `.github/workflows/deploy-staging.yml` — On push to `staging`

```
- Run full CI
- Build & tag Docker images: backend:staging-{sha}, frontend:staging-{sha}
- Push to ECR
- Scan images with Trivy
- Deploy to ECS staging cluster (blue/green or rolling)
- Run smoke tests against staging URL
- Notify on Slack/email
```

#### `.github/workflows/deploy-production.yml` — On push to `main`

```
- Run full CI
- Build & tag Docker images: backend:prod-{sha}, frontend:prod-{sha}
- Push to ECR
- Scan images with Trivy
- Deploy to ECS production (blue/green deployment for zero downtime)
- Run smoke tests against production URL
- Tag git release
- Notify on Slack/email
```

### 5.2 GitHub Secrets Required

```
AWS_ACCESS_KEY_ID          — IAM user for CI/CD (least privilege)
AWS_SECRET_ACCESS_KEY      — IAM user secret
AWS_REGION                 — us-east-2
ECR_REGISTRY               — 131880217305.dkr.ecr.us-east-2.amazonaws.com
ECS_CLUSTER_STAGING        — neuroreach-staging-cluster
ECS_CLUSTER_PRODUCTION     — neuroreach-ai-cluster
ECS_SERVICE_BACKEND_STAGING
ECS_SERVICE_BACKEND_PRODUCTION
ECS_SERVICE_FRONTEND_STAGING
ECS_SERVICE_FRONTEND_PRODUCTION
```

### 🔴 Input needed:
- Create a dedicated IAM user for GitHub Actions (exact policy will be provided)
- Add GitHub secrets (or confirm use of `gh` CLI)
- Slack webhook URL if Slack notifications desired

---

## Phase 6: High Availability & Zero Downtime

**Estimated time:** 3-4 hours

### 6.1 Multi-Instance ECS

- **Backend:** `desiredCount: 2` (minimum), auto-scaling 2-6 based on CPU/memory
- **Frontend:** `desiredCount: 2` (minimum), auto-scaling 2-4
- **Celery Worker:** `desiredCount: 2` (for redundancy)
- ALB already handles load balancing across instances

### 6.2 Blue/Green Deployment (via CodeDeploy)

- ECS + CodeDeploy integration for zero-downtime deploys
- New task set spins up → health checks pass → traffic shifts → old set drains
- Automatic rollback if health checks fail

### 6.3 Auto-Scaling Policies

```
- Backend: Scale up at 70% CPU, scale down at 30% CPU
- Frontend: Scale up at 70% CPU
- Min: 2, Max: 6 (backend), Max: 4 (frontend)
```

### 6.4 Rollback Strategy

- ECR images tagged with git SHA — can always redeploy previous image
- ECS task definition revisions are immutable — rollback = point to previous revision
- Database migrations are additive-only (no destructive changes) — always backward compatible
- GitHub Actions will have a manual "rollback" workflow

### 🔴 Input needed:
- Confirm ECS desired count increase (cost impact: roughly 2x current compute)
- Separate staging ECS cluster or same cluster with different services?

---

## Phase 7: Backups & Disaster Recovery

**Estimated time:** 2-3 hours

### 7.1 RDS Automated Backups

- Enable automated daily snapshots (35-day retention)
- Enable point-in-time recovery (PITR)
- Weekly full backup to S3 via `pg_dump` cronjob

### 7.2 S3 Backup Buckets

```
s3://neuroreach-backups-prod/
  ├── rds/daily/         — pg_dump daily exports
  ├── rds/weekly/        — weekly full dumps
  ├── logs/              — CloudWatch log exports
  └── config/            — task definition snapshots
```

### 7.3 Backup Cronjob (ECS Scheduled Task or Lambda)

```
- Daily 2:00 AM UTC: pg_dump → S3
- Daily 3:00 AM UTC: Export CloudWatch logs → S3
- Weekly Sunday 4:00 AM UTC: Full RDS snapshot
- 90-day retention for daily, 1-year for weekly
```

### 7.4 ElastiCache Backup

- Enable daily automatic backup (Redis persistence)
- 7-day retention

### 🔴 Input needed:
- Create S3 bucket `neuroreach-backups-prod` in us-east-2
- Confirm backup retention periods
- Confirm cost is acceptable (S3 storage ~$0.023/GB/month)

---

## Phase 8: Monitoring & Alerting (Prometheus + Grafana)

**Estimated time:** 3-4 hours

### Option A: AWS-Native (Recommended for cost)

- **CloudWatch Alarms:**
  - ECS CPU > 80%, Memory > 80%
  - ALB 5xx error rate > 1%
  - ALB response time P99 > 5s
  - RDS CPU > 80%, free storage < 5GB
  - ECS desired ≠ running (service degraded)
  - Celery worker task failure rate
- **CloudWatch Dashboards:** Pre-built dashboard for all metrics
- **SNS Alerts:** Email/SMS notifications on alarms

### Option B: Prometheus + Grafana (Full Observability)

- Deploy Prometheus + Grafana as ECS services (or use AWS Managed Grafana)
- Backend already has `prometheus-fastapi-instrumentator` in requirements
- Grafana dashboards for: API latency, error rates, Celery queue depth, DB connections, cache hit rate
- AlertManager for PagerDuty/Slack/email alerts

### 🔴 Input needed:
- Prefer Option A (CloudWatch — cheaper, simpler) or Option B (Prometheus/Grafana — more powerful)?
- Alert notification channel: Email? Slack? PagerDuty? SMS?

---

## Phase 9: Staging Environment Setup

**Estimated time:** 2-3 hours

### 9.1 AWS Resources for Staging

- **ECS Cluster:** `neuroreach-staging-cluster` (or services in same cluster with `-staging` suffix)
- **RDS:** Separate smaller instance `neuroreach-staging-db` (db.t3.micro)
- **ElastiCache:** Separate smaller instance (cache.t3.micro, non-cluster)
- **ALB:** New target groups for staging, or separate ALB
- **DNS:** `api-staging.tmsinstitute.co`, `app-staging.tmsinstitute.co`
- **ECR:** Same repositories, different tags (`staging-*` vs `prod-*`)

### 9.2 Staging-Specific Config

- Separate `.env.staging` with staging DB/Redis endpoints
- Email in sandbox mode (Paubox test mode or redirect to maildev)
- SMS disabled or in test mode
- Seeded test data

### 🔴 Input needed:
- Confirm staging AWS resources creation (cost: ~$50-80/month additional)
- Staging domain DNS setup
- Share same RDS with different database, or completely separate instance?

---

## Phase 10: Documentation

**Estimated time:** 2-3 hours

### 10.1 Operational Runbook (`docs/RUNBOOK.md`)

- How to deploy (CI/CD flow)
- How to rollback
- How to restore from backup
- How to scale up/down
- How to check health
- How to view logs
- How to rotate secrets

### 10.2 Architecture Document (`docs/ARCHITECTURE.md`)

- System architecture diagram
- Network topology
- Data flow diagrams
- Security model

### 10.3 Developer Guide (`docs/DEVELOPMENT.md`)

- Local setup
- Branch workflow (dev → staging → main)
- PR process
- Testing requirements

---

## Summary of What I Need From You

| # | Action | Who |
|---|--------|-----|
| 1 | **Create non-cluster ElastiCache Redis** in AWS Console | You |
| 2 | **Confirm branch cleanup** — OK to delete old branches? | You |
| 3 | **Create IAM user for GitHub Actions** with ECR/ECS permissions | You |
| 4 | **Add GitHub repo secrets** for CI/CD | You (or via `gh` CLI) |
| 5 | **Confirm staging AWS resource creation** (extra cost ~$50-80/mo) | You |
| 6 | **Create S3 backup bucket** `neuroreach-backups-prod` | You |
| 7 | **Confirm monitoring choice:** CloudWatch (A) or Prometheus/Grafana (B) | You |
| 8 | **Alert notification preferences:** Email/Slack/SMS? | You |
| 9 | **Staging domain DNS:** `api-staging.tmsinstitute.co` / `app-staging.tmsinstitute.co` | You |
| 10 | **Confirm desired ECS instance count** (2+ for HA, increases cost ~2x compute) | You |

---

## Execution Order

| Phase | Description | Dependencies | Est. Time |
|-------|-------------|--------------|-----------|
| **2** | Code cleanup & secrets | None | 2-3h |
| **3** | Docker hardening | None | 2-3h |
| **1** | Fix Celery (Redis) | Your AWS action | 1-2h |
| **4** | Git branch strategy | Phases 2,3 done | 2-3h |
| **5** | CI/CD pipeline | Phase 4 done + your IAM/secrets | 4-5h |
| **6** | HA & zero downtime | Phase 5 done | 3-4h |
| **7** | Backups & DR | Your S3 bucket | 2-3h |
| **8** | Monitoring & alerting | Your choice A/B | 3-4h |
| **9** | Staging environment | Your AWS resources | 2-3h |
| **10** | Documentation | All phases | 2-3h |

**Total estimated effort: 24-34 hours**

---

*End of deployment plan.*
