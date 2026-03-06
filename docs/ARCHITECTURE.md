# 🏗️ NeuroReach AI — System Architecture

**Last Updated:** 2026-03-06  
**Version:** 1.8.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [AWS Infrastructure](#3-aws-infrastructure)
4. [Application Components](#4-application-components)
5. [Network Topology](#5-network-topology)
6. [Data Flow](#6-data-flow)
7. [Security Model](#7-security-model)
8. [CI/CD Pipeline Architecture](#8-cicd-pipeline-architecture)
9. [Monitoring Architecture](#9-monitoring-architecture)
10. [Environments](#10-environments)

---

## 1. Overview

NeuroReach AI is a **HIPAA-compliant** patient intake and CRM platform for TMS (Transcranial Magnetic Stimulation) therapy clinics. It provides:

- **Multi-condition intake forms** (widget + standalone assessment)
- **Coordinator dashboard** for lead management
- **Provider referral management**
- **HIPAA-compliant email** (Paubox) and **SMS** (Twilio)
- **Call analytics** (CallRail integration)
- **Lead scoring** with priority queuing
- **PHI encryption at rest** (AES-256)
- **Audit logging** for compliance

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python 3.11 + FastAPI + Uvicorn |
| Database | PostgreSQL 14 (AWS RDS) |
| Cache | Redis 7 (AWS ElastiCache) |
| Task Queue | Celery 5 + Redis broker |
| Container | Docker + AWS ECS Fargate |
| Load Balancer | AWS ALB with HTTPS/TLS |
| CI/CD | GitHub Actions |
| Email | Paubox HIPAA API |
| SMS | Twilio |
| Monitoring | AWS CloudWatch |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNET / USERS                                │
│                                                                         │
│   👤 Patients         👩‍⚕️ Coordinators        🌐 WordPress Site        │
│   (Assessment/Widget)  (Dashboard)             (Embedded Widget)         │
└────────────┬───────────────┬───────────────────────┬────────────────────┘
             │               │                       │
             │          HTTPS (443)                   │
             │       *.tmsinstitute.co                │
             ▼               ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AWS APPLICATION LOAD BALANCER (ALB)                   │
│                                                                         │
│  ACM Certificate: *.tmsinstitute.co (wildcard)                          │
│                                                                         │
│  ┌─────────────────────────┐   ┌──────────────────────────────────────┐│
│  │ Host: app-staging.*     │   │ Default Rule (app.* / api.*)        ││
│  │ Priority: 10            │   │                                      ││
│  │ → staging-backend-tg    │   │ → production-backend-tg             ││
│  └─────────────────────────┘   └──────────────────────────────────────┘│
└──────────────┬──────────────────────────────────┬──────────────────────┘
               │                                  │
      ┌────────▼────────┐               ┌────────▼────────────────┐
      │  STAGING TG      │               │  PRODUCTION TG          │
      │  (1 instance)    │               │  (2-6 instances)        │
      └────────┬─────────┘               └────────┬───────────────┘
               │                                  │
┌──────────────▼──────────────────────────────────▼──────────────────────┐
│                        AWS ECS FARGATE CLUSTER                         │
│                      (neuroreach-ai-cluster)                           │
│                                                                        │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐│
│  │  PRODUCTION SERVICES         │  │  STAGING SERVICES                ││
│  │                              │  │                                  ││
│  │  ┌────────────────────────┐  │  │  ┌──────────────────────────┐   ││
│  │  │ Backend Service (x2-6) │  │  │  │ Backend Service (x1)     │   ││
│  │  │ neuroreach-ai-backend  │  │  │  │ neuroreach-staging-backend│   ││
│  │  │ FastAPI + Uvicorn      │  │  │  │ 256 CPU / 512 MB         │   ││
│  │  │ 512 CPU / 1024 MB     │  │  │  └──────────────────────────┘   ││
│  │  │ Port: 8000             │  │  │                                  ││
│  │  │ Auto-scale: 70% CPU   │  │  │  ┌──────────────────────────┐   ││
│  │  └────────────────────────┘  │  │  │ Celery Service (x1)      │   ││
│  │                              │  │  │ neuroreach-staging-celery │   ││
│  │  ┌────────────────────────┐  │  │  │ 256 CPU / 512 MB         │   ││
│  │  │ Celery Service (x2-4)  │  │  │  └──────────────────────────┘   ││
│  │  │ neuroreach-ai-celery   │  │  │                                  ││
│  │  │ 512 CPU / 1024 MB     │  │  └──────────────────────────────────┘│
│  │  │ Auto-scale: 70% CPU   │  │                                      │
│  │  └────────────────────────┘  │                                      │
│  └─────────────────────────────┘                                      │
└───────────┬──────────────┬────────────────────────────────────────────┘
            │              │
   ┌────────▼──────┐  ┌───▼────────────────────┐
   │ PRODUCTION     │  │ PRODUCTION              │
   │ RDS PostgreSQL │  │ ElastiCache Redis       │
   │                │  │                          │
   │ neuroreach-    │  │ neuroreach-ai-redis-v2   │
   │ ai-db          │  │ Non-cluster, TLS         │
   │ db.t3.micro    │  │ cache.t3.micro           │
   │ 20GB gp2       │  │                          │
   │ Multi-AZ: No   │  │ Used for:                │
   │                │  │ • Celery broker           │
   │ Backups:       │  │ • API response caching    │
   │ • 35-day auto  │  │ • Rate limiting           │
   │ • PITR enabled │  │                          │
   │ • Daily S3     │  │ Backups: 7-day daily      │
   └────────────────┘  └──────────────────────────┘

   ┌────────────────┐  ┌──────────────────────────┐
   │ STAGING         │  │ STAGING                   │
   │ RDS PostgreSQL  │  │ ElastiCache Redis         │
   │ neuroreach-     │  │ neuroreach-staging-redis   │
   │ staging-db      │  │ Non-cluster, TLS           │
   │ db.t3.micro     │  │ cache.t3.micro             │
   └────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                │
│                                                                         │
│  📧 Paubox API ──── HIPAA-compliant email (support@tmsinstitute.co)     │
│  📱 Twilio API ──── SMS notifications                                   │
│  📞 CallRail API ── Call tracking & analytics                           │
│  📊 Google Ads ──── Lead form webhook                                   │
│  📋 Jotform ─────── Intake form webhook                                │
│  🪣 S3 ──────────── Backup storage (neuroreach-backups-prod)            │
│  📢 SNS ─────────── Alert notifications (neuroreach-ai-alerts)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. AWS Infrastructure

### 3.1 Region & Account

| Item | Value |
|------|-------|
| AWS Account | `131880217305` |
| Region | `us-east-2` (Ohio) |
| VPC | `vpc-00bed95435b092a79` (default) |

### 3.2 Compute (ECS Fargate)

| Resource | Type | Details |
|----------|------|---------|
| ECS Cluster | `neuroreach-ai-cluster` | Single cluster for prod + staging |
| Prod Backend | Service (2-6 tasks) | 512 CPU, 1024 MB, auto-scaling |
| Prod Celery | Service (2-4 tasks) | 512 CPU, 1024 MB, auto-scaling |
| Staging Backend | Service (1 task) | 256 CPU, 512 MB |
| Staging Celery | Service (1 task) | 256 CPU, 512 MB |
| ECR Repository | `neuroreach-ai/backend` | Single repo, multi-tag |

### 3.3 Database (RDS)

| Resource | Production | Staging |
|----------|-----------|---------|
| Instance | `neuroreach-ai-db` | `neuroreach-staging-db` |
| Engine | PostgreSQL 14 | PostgreSQL 14.22 |
| Class | db.t3.micro | db.t3.micro |
| Storage | 20 GB gp2 | 20 GB gp3 |
| Backup | 35-day retention + PITR | 7-day retention |
| Encryption | At rest (AES-256) | At rest (AES-256) |

### 3.4 Cache (ElastiCache)

| Resource | Production | Staging |
|----------|-----------|---------|
| Instance | `neuroreach-ai-redis-v2` | `neuroreach-staging-redis` |
| Engine | Redis 7.x | Redis 7.1 |
| Mode | Non-cluster | Non-cluster |
| TLS | Enabled | Enabled |
| Class | cache.t3.micro | cache.t3.micro |

### 3.5 Networking

| Resource | Details |
|----------|---------|
| ALB | `neuroreach-ai-alb` (shared prod + staging) |
| HTTPS Listener | Port 443, ACM wildcard cert `*.tmsinstitute.co` |
| Prod Target Group | `neuroreach-ai-backend-tg` (default rule) |
| Staging Target Group | `neuroreach-staging-backend-tg` (host: `app-staging.*`, priority 10) |
| Security Group (ALB) | `sg-03a7a894fe7d1ae95` — Inbound 80, 443 from 0.0.0.0/0 |
| Security Group (ECS) | `sg-09c3b2d49128ef801` — Inbound 8000 from ALB SG |
| Security Group (DB) | `sg-04fb90766775d2c72` — Inbound 5432 from ECS SG |
| Private Subnets | `subnet-01887d3dffe21e406`, `subnet-06f6d75a08dac175f` |

### 3.6 Storage

| Resource | Purpose |
|----------|---------|
| S3: `neuroreach-backups-prod` | Database backups, log archives |
| ECR: `neuroreach-ai/backend` | Docker images |

### 3.7 Monitoring

| Resource | Purpose |
|----------|---------|
| CloudWatch Dashboard | `NeuroReach-AI-Production` — 22 widgets |
| CloudWatch Alarms | 13 alarms (ECS, ALB, RDS) |
| CloudWatch Log Groups | 4 log groups (prod + staging backend + celery) |
| SNS Topic | `neuroreach-ai-alerts` — alarm notifications |
| Container Insights | Enabled on cluster for task-level metrics |

---

## 4. Application Components

### 4.1 Backend API (FastAPI)

```
backend/src/
├── main.py                     # FastAPI app, routes, middleware, CORS
├── api/                        # API route handlers
│   ├── analytics.py            # Dashboard analytics endpoints
│   ├── auth.py                 # Login, token refresh, password reset
│   ├── callrail.py             # CallRail proxy endpoints
│   ├── communications.py       # Email/SMS sending endpoints
│   ├── health.py               # Health check endpoints (/health, /health/live)
│   ├── leads.py                # Lead CRUD + widget submission
│   ├── providers.py            # Provider management
│   ├── users.py                # User management (RBAC)
│   ├── webhooks.py             # Jotform + Google Ads webhooks
│   └── widget.py               # Widget/assessment page serving
├── core/                       # Core framework
│   ├── auth.py                 # JWT authentication middleware
│   ├── config.py               # Settings from environment variables
│   ├── database.py             # SQLAlchemy async engine + sessions
│   └── security.py             # Password hashing (bcrypt)
├── models/                     # SQLAlchemy ORM models
│   ├── lead.py                 # Lead model (encrypted PHI fields)
│   ├── provider.py             # Provider model
│   ├── user.py                 # User model (roles: admin, coordinator)
│   ├── audit_log.py            # Audit log model
│   └── lead_note.py            # Lead notes model
├── services/                   # Business logic
│   ├── audit.py                # Audit logging service
│   ├── cache.py                # Redis cache wrapper
│   ├── email_service.py        # Email routing (Paubox/SMTP/log)
│   ├── encryption.py           # AES-256 PHI encryption
│   ├── lead_scoring_v2.py      # Lead priority scoring algorithm
│   ├── paubox_email_service.py # Paubox HIPAA email API
│   ├── sms_service.py          # SMS routing (Twilio/log)
│   ├── sync_notifications.py   # Synchronous notification wrapper
│   └── twilio_service.py       # Twilio SMS API
├── tasks/                      # Celery async tasks
│   ├── celery_app.py           # Celery configuration
│   └── lead_tasks.py           # Email/SMS task definitions
└── schemas/                    # Pydantic request/response schemas
    ├── lead.py
    ├── provider.py
    └── user.py
```

### 4.2 Frontend (React)

```
frontend/src/
├── App.tsx                     # Main app with routing
├── main.tsx                    # App entry point
├── widget-embed.tsx            # Widget bundle entry
├── assessment-entry.tsx        # Assessment bundle entry
├── pages/                      # Route pages
│   ├── Dashboard.tsx           # Main coordinator dashboard
│   ├── CoordinatorDashboard.tsx # Coordinator-specific view
│   ├── ProvidersDashboard.tsx  # Provider management
│   ├── AnalyticsDashboard.tsx  # Analytics & reports
│   ├── SettingsDashboard.tsx   # Settings & user management
│   ├── CallAnalyticsDashboard.tsx # CallRail analytics
│   ├── DeletedLeadsDashboard.tsx  # Soft-deleted leads
│   ├── LoginPage.tsx           # Authentication
│   └── AssessmentPage.tsx      # Standalone assessment
├── components/
│   ├── dashboard/              # Dashboard components (sidebar, tables, modals)
│   ├── widget/                 # Intake widget steps
│   ├── widget-embed/           # Embeddable widget wrapper
│   └── common/                 # Shared components (Badge, ErrorBoundary)
├── hooks/                      # React hooks (useLeads, useAuth, useAnalytics...)
├── services/                   # API client services
├── types/                      # TypeScript type definitions
└── utils/                      # Utility functions
```

### 4.3 Three Build Outputs

| Build | Entry Point | Output Dir | Served At |
|-------|------------|------------|-----------|
| Main App | `main.tsx` | `dist/` | `app.tmsinstitute.co` (SPA) |
| Widget | `widget-embed.tsx` | `dist-widget/` | `api.tmsinstitute.co/widget-embed.js` |
| Assessment | `assessment-entry.tsx` | `dist-assessment/` | `api.tmsinstitute.co/assessment` |

### 4.4 Database Schema (23 Migrations)

| Migration | Purpose |
|-----------|---------|
| 001 | Initial schema (leads, providers, users, audit_logs) |
| 002-006 | Scheduling, contact outcomes, performance, platform analytics, referrals |
| 007-009 | Source tracking, soft delete, user management |
| 010 | Multi-condition intake (v2 form) |
| 011-015 | Performance indexes, specialty, scheduled outcome, last_updated, scale |
| 016-018 | Invitation flow, password reset, primary admin role |
| 019-023 | Production indexes, lead notes, cleanup, TMS index, referral reconciliation |

---

## 5. Network Topology

```
Internet
    │
    ▼
┌─────────────────┐
│  AWS ALB         │  ← HTTPS termination (ACM cert)
│  (Public subnet) │  ← WAF (future)
└────────┬────────┘
         │ Port 8000
         ▼
┌─────────────────┐
│  ECS Tasks       │  ← Private subnets
│  (Fargate)       │  ← No public IPs
│  SG: 8000 from   │
│  ALB SG only     │
└───┬─────────┬───┘
    │         │
    ▼         ▼
┌────────┐ ┌────────────┐
│  RDS   │ │ ElastiCache │  ← Private subnets
│  PG14  │ │ Redis 7     │  ← SG: 5432/6379 from ECS SG only
│  5432  │ │ 6379 (TLS)  │
└────────┘ └─────────────┘
```

**Key security boundaries:**
- ALB accepts traffic from internet (ports 80→redirect, 443)
- ECS tasks only accept traffic from ALB security group
- RDS/Redis only accept traffic from ECS security group
- All ECS tasks run in private subnets (no public IP)
- All Redis connections use TLS (`rediss://`)

---

## 6. Data Flow

### 6.1 Lead Submission Flow

```
Patient fills form (Widget/Assessment/Jotform/Google Ads)
    │
    ▼
POST /api/leads/submit (or /api/webhooks/*)
    │
    ▼
┌────────────────────────────────────┐
│ 1. Validate input (Pydantic)       │
│ 2. Encrypt PHI (AES-256)           │
│ 3. Score lead (priority algorithm) │
│ 4. Save to PostgreSQL              │
│ 5. Send receipt email (Paubox)     │
│ 6. Send receipt SMS (Twilio)       │
│ 7. Log to audit trail              │
│ 8. Return lead_id + priority       │
└────────────────────────────────────┘
```

### 6.2 Coordinator Action Flow

```
Coordinator logs in (app.tmsinstitute.co)
    │
    ▼
POST /api/auth/login → JWT access token (30 min)
    │
    ▼
GET /api/leads → Decrypted lead list
    │
    ▼
Coordinator sends email/SMS:
POST /api/communications/email/send → Paubox API
POST /api/communications/sms/send → Twilio API
    │
    ▼
Action logged in audit_logs table
```

---

## 7. Security Model

### 7.1 PHI Protection (HIPAA)

| Control | Implementation |
|---------|---------------|
| Encryption at rest (DB) | AES-256 Fernet + PBKDF2 for first_name, last_name, email, phone |
| Encryption in transit | TLS 1.2+ everywhere (ALB, Redis, RDS) |
| Access control | JWT + RBAC (administrator, coordinator roles) |
| Audit trail | All data access/modifications logged to `audit_logs` table |
| Email | HIPAA-compliant via Paubox API (BAA signed) |
| Backups | Encrypted at rest (RDS AES-256, S3 AES-256) |
| Secret management | ECS task definition env vars (future: AWS Secrets Manager) |

### 7.2 Authentication

| Feature | Details |
|---------|---------|
| Algorithm | JWT HS256 |
| Access token TTL | 30 minutes |
| Refresh token TTL | 7 days |
| Password hashing | bcrypt |
| Failed login | Rate limited |

### 7.3 CI/CD Security

| Control | Implementation |
|---------|---------------|
| Secret scanning | Gitleaks in every PR |
| Vulnerability scanning | Trivy (filesystem + Docker image) |
| IAM least privilege | `github-actions-cicd` user (ECR push + ECS deploy only) |
| Branch protection | Required PR reviews for `main` and `staging` |

---

## 8. CI/CD Pipeline Architecture

```
                    ┌──────────────────┐
                    │  GitHub Actions   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
     │  ci.yml      │  │ staging    │  │ production  │
     │  (PRs)       │  │ (staging)  │  │ (main)      │
     └──────┬───────┘  └─────┬──────┘  └──────┬──────┘
            │                │                │
   ┌────────▼──────────┐    │                │
   │ 9 parallel jobs:  │    │                │
   │ • Flake8          │    ▼                ▼
   │ • ESLint          │  Build → ECR →  Build → ECR →
   │ • MyPy            │  Deploy ECS     CI → Deploy ECS
   │ • TypeScript      │  Smoke Tests    Smoke Tests
   │ • Pytest          │                 Git Tag
   │ • Vitest          │
   │ • Trivy           │
   │ • Gitleaks        │
   │ • Frontend Build  │
   │ → Docker Build    │
   └───────────────────┘

   Additionally:
   ┌────────────────┐  ┌────────────────┐
   │ backup.yml     │  │ rollback.yml   │
   │ Daily 2AM UTC  │  │ Manual trigger │
   │ Weekly Sun 4AM │  │ Instant revert │
   └────────────────┘  └────────────────┘
```

### Workflow Files

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | PRs to any branch | Lint, type check, test, security scan, build verify |
| `.github/workflows/deploy-staging.yml` | Push to `staging` | Build, push ECR, deploy staging ECS, smoke test |
| `.github/workflows/deploy-production.yml` | Push to `main` | Full CI → build, push ECR, deploy prod ECS, smoke test, git tag |
| `.github/workflows/backup.yml` | Cron (daily/weekly) | pg_dump → S3 backup |
| `.github/workflows/rollback.yml` | Manual dispatch | Instant production rollback |

---

## 9. Monitoring Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AWS CloudWatch                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Dashboard: NeuroReach-AI-Production (22 widgets) │   │
│  │  • Alarm status overview                          │   │
│  │  • ECS CPU/Memory/Tasks                           │   │
│  │  • ALB requests/errors/latency                    │   │
│  │  • RDS CPU/storage/connections/IOPS               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │  13 CloudWatch Alarms │───►│  SNS Topic             │ │
│  │  • Backend CPU/Mem    │    │  neuroreach-ai-alerts   │ │
│  │  • Celery CPU/Mem     │    │                         │ │
│  │  • ALB 5xx errors     │    │  → Email subscribers    │ │
│  │  • ALB latency        │    │  → SMS subscribers      │ │
│  │  • RDS CPU/Storage    │    └────────────────────────┘ │
│  │  • Service degraded   │                               │
│  │  • Unhealthy hosts    │                               │
│  └──────────────────────┘                               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Log Groups                                       │   │
│  │  /ecs/neuroreach-ai-backend     (prod backend)    │   │
│  │  /ecs/neuroreach-ai-celery      (prod celery)     │   │
│  │  /ecs/neuroreach-staging-backend (staging backend) │   │
│  │  /ecs/neuroreach-staging-celery  (staging celery)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Container Insights: ENABLED (task-level metrics)        │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Environments

### 10.1 Environment Comparison

| Aspect | Production | Staging |
|--------|-----------|---------|
| URL | `app.tmsinstitute.co` | `app-staging.tmsinstitute.co` |
| Backend instances | 2-6 (auto-scale) | 1 (fixed) |
| Celery instances | 2-4 (auto-scale) | 1 (fixed) |
| CPU / Memory | 512 / 1024 MB | 256 / 512 MB |
| RDS | `neuroreach-ai-db` | `neuroreach-staging-db` |
| Redis | `neuroreach-ai-redis-v2` | `neuroreach-staging-redis` |
| Email mode | `paubox` (real HIPAA email) | `log` (logged only) |
| SMS mode | `twilio` (real SMS) | `log` (logged only) |
| Backups | 35-day RDS + S3 daily | 7-day RDS only |
| Monitoring | 13 alarms + dashboard | Basic CloudWatch logs |
| Deploy trigger | Push to `main` | Push to `staging` |
| Estimated cost | ~$150-200/month | ~$50-80/month |

### 10.2 Branch → Environment Mapping

```
dev        → No deployment (local development only)
staging    → Deploys to staging environment
main       → Deploys to production environment
```

---

*End of Architecture Document*
