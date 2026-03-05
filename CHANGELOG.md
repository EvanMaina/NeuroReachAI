# Changelog

All notable changes to NeuroReach AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-03-05

### Fixed
- **Email routing**: Forgot-password, request-access, and invitation emails now route through Paubox HIPAA-compliant API in production (was incorrectly using raw SMTP)
- **Redis cache SSL**: Fixed `cache.py` to properly handle `rediss://` URLs with TLS query parameters for ElastiCache compatibility
- **Celery worker**: Re-provisioned ElastiCache Redis v2 in non-cluster mode to resolve CROSSSLOT errors; Celery broker and result backend now connect reliably

### Added
- `sync_notifications.py` — synchronous notification fallback when Celery is unavailable
- `backend/scripts/create_production_users.py` — production user provisioning script
- `backend/scripts/init_database.py` — database initialization script
- `backend/.dockerignore` — excludes unnecessary files from Docker build context
- `backend/.env.example` and `frontend/.env.example` — placeholder environment templates
- `docker-compose.prod.yml` — production-only Docker Compose (no dev services)
- `docs/DEPLOYMENT_PLAN.md` — comprehensive 10-phase deployment plan
- `docs/AWS_DEPLOYMENT_STATUS.md` — AWS infrastructure documentation

### Changed
- Updated `.gitignore` to exclude ECS task definitions, test scripts, response dumps, and deployment artifacts
- Hardened Celery app configuration for AWS ElastiCache TLS connections
- Backend Dockerfile improvements for production builds

### Security
- Removed hardcoded secrets from committed documentation files
- Added `.env` patterns to `.gitignore` to prevent secret leakage
- Email sending now uses HIPAA-compliant Paubox API exclusively in production

## [1.1.0] - 2026-03-04

### Added
- Cache-Control headers for API responses
- Provider email dialog for coordinator dashboard
- Consultation panel with outcome tracking
- Quick action panel for common coordinator workflows
- Production audit reports (v3, v4)
- Comprehensive production hardening

### Fixed
- Analytics/Coordinator dashboard pagination and KPI date filter mismatch
- PHI decrypt null-coalescing for encrypted fields

## [1.0.0] - 2026-03-03

### Added
- Complete TMS therapy patient intake platform
- Multi-condition intake form (v2) with step-by-step wizard
- HIPAA-compliant PHI encryption at rest
- Coordinator dashboard with lead management
- Provider management and referral tracking
- Call analytics integration (CallRail)
- Assessment page with embeddable widget
- Lead scoring system (v2) with priority queuing
- Lead notes and follow-up scheduling
- Soft delete with recovery for leads
- User management with role-based access control
- Platform analytics dashboard
- Source analytics tracking (UTM, referral)
- Paubox HIPAA-compliant email service
- Twilio SMS notifications
- Celery async task processing
- Redis caching layer
- PostgreSQL with comprehensive migration system (23 migrations)
- Docker containerization for all services
- AWS ECS Fargate deployment (backend, celery, frontend)
- AWS RDS PostgreSQL database
- AWS ElastiCache Redis
- AWS ALB with HTTPS/TLS termination
