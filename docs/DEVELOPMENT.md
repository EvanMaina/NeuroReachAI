# 👨‍💻 NeuroReach AI — Developer Guide

**Last Updated:** 2026-03-06  
**Version:** 1.8.0

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Project Structure](#3-project-structure)
4. [Git Branch Workflow](#4-git-branch-workflow)
5. [Pull Request Process](#5-pull-request-process)
6. [Testing](#6-testing)
7. [Code Style & Linting](#7-code-style--linting)
8. [Environment Variables](#8-environment-variables)
9. [Database Migrations](#9-database-migrations)
10. [Common Tasks](#10-common-tasks)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x | Frontend build |
| Python | 3.11.x | Backend runtime |
| Docker | 24.x+ | Container builds |
| Git | 2.x | Version control |
| AWS CLI | v2 | AWS operations |
| GitHub CLI (`gh`) | Latest | Pipeline management |

### Install Commands (Windows)

```bash
# Node.js (via nvm-windows or direct download)
# https://nodejs.org/en/download/

# Python 3.11
# https://www.python.org/downloads/

# Docker Desktop
# https://www.docker.com/products/docker-desktop/

# AWS CLI v2
# https://awscli.amazonaws.com/AWSCLIV2.msi

# GitHub CLI
winget install --id GitHub.cli
```

---

## 2. Local Development Setup

### 2.1 Clone & Install

```bash
# Clone the repository
git clone https://github.com/EvanMaina/NeuroReachAI.git
cd NeuroReachAI

# Switch to dev branch
git checkout dev

# Backend setup
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

### 2.2 Docker Compose (Full Stack)

The easiest way to run everything locally:

```bash
# Start all services (DB, Redis, Backend, Frontend, MailDev)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all
docker-compose down
```

Services available after `docker-compose up`:
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:5173` | React SPA (Vite dev server) |
| Backend API | `http://localhost:8000` | FastAPI |
| MailDev | `http://localhost:1080` | Email testing UI |
| PostgreSQL | `localhost:5432` | Database |
| Redis | `localhost:6379` | Cache + Celery broker |

### 2.3 Manual Start (Without Docker)

**Backend:**
```bash
cd backend
venv\Scripts\activate

# Set environment variables (copy from .env.example)
copy .env.example .env
# Edit .env with your local values

# Run the API server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend

# Set environment
copy .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:8000

# Run dev server
npm run dev
```

**Celery Worker (optional):**
```bash
cd backend
venv\Scripts\activate
celery -A src.tasks.celery_app:celery_app worker --loglevel=info
```

### 2.4 Initialize Local Database

```bash
cd backend

# Run all SQL migrations
python scripts/init_database.py

# Create admin user
python scripts/create_production_users.py
```

---

## 3. Project Structure

```
NeuroReach-AI/
├── .github/workflows/          # CI/CD pipelines
│   ├── ci.yml                  # PR checks (lint, test, build)
│   ├── deploy-production.yml   # Production deployment
│   ├── deploy-staging.yml      # Staging deployment
│   ├── backup.yml              # Automated DB backups
│   └── rollback.yml            # One-click rollback
├── backend/                    # Python FastAPI backend
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Environment template
│   ├── scripts/                # Utility scripts
│   └── src/                    # Application source code
├── frontend/                   # React + TypeScript frontend
│   ├── Dockerfile              # Nginx-based Docker build
│   ├── package.json            # Node dependencies
│   ├── .env.example            # Environment template
│   ├── vite.config.ts          # Main app build config
│   ├── vite.config.widget.ts   # Widget build config
│   ├── vite.config.assessment.ts # Assessment build config
│   └── src/                    # Application source code
├── database/init/              # SQL migration files (001-023)
├── infrastructure/             # AWS infrastructure configs
│   ├── cloudwatch-dashboard.json
│   ├── staging-backend-taskdef.json
│   ├── staging-celery-taskdef.json
│   └── staging-db-init-taskdef.json
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── DEVELOPMENT.md          # This file
│   ├── OPERATIONS_RUNBOOK.md   # Ops runbook
│   ├── DEPLOYMENT_PLAN.md      # Original deployment plan
│   └── AWS_DEPLOYMENT_STATUS.md # AWS status
├── docker-compose.yml          # Local dev compose
├── docker-compose.prod.yml     # Production compose
├── CHANGELOG.md                # Version changelog
└── README.md                   # Project overview
```

---

## 4. Git Branch Workflow

### 4.1 Branch Structure

```
main (production)
  ↑ PR required (deploys to production on merge)
staging
  ↑ PR required (deploys to staging on merge)
dev
  ↑ Feature branches
feature/your-feature
```

### 4.2 Development Flow

```bash
# 1. Always start from dev
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes, commit
git add .
git commit -m "feat: add new feature description"

# 4. Push feature branch
git push origin feature/my-feature

# 5. Create PR: feature/my-feature → dev
gh pr create --base dev --title "feat: my feature" --body "Description"

# 6. After PR review + merge to dev, promote to staging
gh pr create --base staging --head dev --title "Deploy to staging"

# 7. After staging verification, promote to production
gh pr create --base main --head staging --title "Release: v1.x.x"
```

### 4.3 Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types:
  feat     — New feature
  fix      — Bug fix
  docs     — Documentation only
  style    — Code formatting (no logic change)
  refactor — Code restructure (no feature/fix)
  perf     — Performance improvement
  test     — Adding/fixing tests
  chore    — Build, CI, dependency updates
  security — Security fix

Examples:
  feat(leads): add bulk export to CSV
  fix(auth): handle expired refresh tokens
  docs: update operations runbook
  chore(ci): upgrade Trivy to v0.25.0
```

### 4.4 Branch Rules

| Branch | Protection | Deploys To |
|--------|-----------|------------|
| `main` | PR required, no force push | Production |
| `staging` | PR required, no force push | Staging |
| `dev` | Direct push allowed | Nothing (local only) |

---

## 5. Pull Request Process

### 5.1 PR Checklist

Before creating a PR, ensure:

- [ ] Code compiles without errors
- [ ] All existing tests pass locally
- [ ] New tests written for new features
- [ ] `CHANGELOG.md` updated (required for PRs to `main`)
- [ ] No console.log (frontend) or print() (backend) outside dev guards
- [ ] No secrets or credentials in code
- [ ] API changes documented

### 5.2 CI Checks (Automatic)

When you create a PR, these checks run automatically:

| Check | Tool | Must Pass? |
|-------|------|-----------|
| Backend lint | Flake8 | Recommended |
| Frontend lint | ESLint | Recommended |
| Backend types | MyPy | Recommended |
| Frontend types | TypeScript (`tsc`) | Recommended |
| Backend tests | Pytest | Recommended |
| Frontend tests | Vitest | Recommended |
| Security scan | Trivy | Informational |
| Secret scan | Gitleaks | **Required** |
| Frontend build | Vite | **Required** |
| Docker build | Docker | **Required** |
| Changelog | Check modified | Required for `main` |

### 5.3 Review Process

1. Create PR with clear description
2. CI checks run automatically (~2-3 minutes)
3. Reviewer reviews code
4. Address feedback, push fixes
5. Reviewer approves
6. Merge (squash or merge commit)

---

## 6. Testing

### 6.1 Backend Tests (Pytest)

```bash
cd backend
venv\Scripts\activate

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=term-missing

# Run specific test file
pytest tests/test_leads.py

# Run specific test
pytest tests/test_leads.py::test_create_lead -v
```

### 6.2 Frontend Tests (Vitest)

```bash
cd frontend

# Run all tests
npm test

# Run with watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/hooks/useLeads.test.ts
```

### 6.3 Integration Testing

```bash
# Full stack via Docker
docker-compose up -d
curl -s http://localhost:8000/health
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'
```

---

## 7. Code Style & Linting

### 7.1 Backend (Python)

```bash
cd backend
venv\Scripts\activate

# Lint with Flake8
flake8 src/ --max-line-length=120 --exclude=__pycache__,venv

# Type check with MyPy
mypy src/ --ignore-missing-imports --no-strict-optional
```

**Style rules:**
- Max line length: 120 characters
- Use type hints for function parameters and returns
- Use `logger.info()` instead of `print()` for logging
- Follow PEP 8

### 7.2 Frontend (TypeScript)

```bash
cd frontend

# Lint with ESLint
npx eslint src/ --ext .ts,.tsx

# Type check
npx tsc --noEmit
```

**Style rules:**
- Use TypeScript strict mode
- Use functional components with hooks
- Use `console.log` only inside `if (import.meta.env.DEV)` guards
- Keep components under 300 lines (extract sub-components)

---

## 8. Environment Variables

### 8.1 Backend (`backend/.env.example`)

```env
# Core
ENVIRONMENT=development
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-64-char-hex-key

# Database
DATABASE_URL=postgresql+asyncpg://neuroreach:password@localhost:5432/neuroreach

# Redis
REDIS_URL=redis://localhost:6379/0

# Email
EMAIL_MODE=log          # Options: log, smtp, paubox
SMTP_HOST=localhost
SMTP_PORT=1025

# SMS
SMS_MODE=log            # Options: log, twilio

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 8.2 Frontend (`frontend/.env.example`)

```env
VITE_API_URL=http://localhost:8000
```

### 8.3 Email/SMS Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `log` | Logs message content, doesn't send | Local development |
| `smtp` | Sends via SMTP (MailDev locally) | Integration testing |
| `paubox` | Sends via Paubox HIPAA API | Production only |
| `twilio` | Sends via Twilio API | Production only |

---

## 9. Database Migrations

### 9.1 Migration Files

All migrations are in `database/init/` as numbered SQL files:

```
database/init/
├── 001_initial_schema.sql
├── 002_add_scheduling.sql
├── 002_contact_outcomes.sql
├── 003_performance_optimization.sql
├── ...
└── 023_reconcile_provider_referral_counts.sql
```

### 9.2 Adding a New Migration

1. Create a new SQL file with the next number:
   ```
   database/init/024_your_migration_name.sql
   ```

2. Write idempotent SQL (use `IF NOT EXISTS`, `DO $$ ... $$`):
   ```sql
   -- 024: Add new_column to leads
   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'leads' AND column_name = 'new_column'
       ) THEN
           ALTER TABLE leads ADD COLUMN new_column VARCHAR(100);
       END IF;
   END $$;
   ```

3. Test locally:
   ```bash
   psql -h localhost -U neuroreach -d neuroreach -f database/init/024_your_migration_name.sql
   ```

4. Update `backend/scripts/init_database.py` if needed

### 9.3 Important Rules

- **Never** write destructive migrations (DROP TABLE, DELETE) without a backup plan
- Always make migrations **idempotent** (safe to run multiple times)
- Always make migrations **backward compatible** (old code should work with new schema)
- Test migrations against a copy of production data before deploying

---

## 10. Common Tasks

### 10.1 Add a New API Endpoint

1. Create route handler in `backend/src/api/your_module.py`
2. Add Pydantic schemas in `backend/src/schemas/`
3. Register router in `backend/src/main.py`
4. Add frontend service in `frontend/src/services/`
5. Add React hook in `frontend/src/hooks/`
6. Update types in `frontend/src/types/`

### 10.2 Add a New Dashboard Page

1. Create page in `frontend/src/pages/YourPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Add sidebar link in `frontend/src/components/dashboard/Sidebar.tsx`

### 10.3 Build Widget Bundle

```bash
cd frontend
npm run build:widget
# Output: frontend/dist-widget/widget-embed.js
```

### 10.4 Build Assessment Bundle

```bash
cd frontend
npm run build:assessment
# Output: frontend/dist-assessment/
```

### 10.5 Build Docker Image Locally

```bash
cd backend
docker build --target production -t neuroreach-backend:local -f Dockerfile .
docker run -p 8000:8000 --env-file .env neuroreach-backend:local
```

### 10.6 Check Production Health

```bash
curl -s https://api.tmsinstitute.co/health | python -m json.tool
```

### 10.7 View Pipeline Status

```bash
gh run list --repo EvanMaina/NeuroReachAI --limit 5
```

---

*End of Developer Guide*
