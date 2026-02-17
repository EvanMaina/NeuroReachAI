# NeuroReach AI

<p align="center">
  <strong>HIPAA-Compliant Lead Management & Patient Intake Platform for TMS Clinics</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-50.4%25-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Python-42.9%25-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/HIPAA-Compliant-green" alt="HIPAA Compliant">
</p>

---

## Overview

NeuroReach AI is a full-stack lead management and patient intake platform purpose-built for **Transcranial Magnetic Stimulation (TMS)** clinics. It streamlines the entire patient journey — from initial inquiry through consultation scheduling to treatment onboarding — while maintaining strict HIPAA compliance with AES-256 PHI encryption.

## Key Features

### 🏥 Patient Intake & Assessment
- **Multi-step intake widget** — Embeddable widget for clinic websites capturing condition, treatment history, insurance, location, severity, and consent
- **Self-assessment page** — Standalone patient assessment with TMS interest evaluation
- **Lead scoring v2** — Intelligent lead prioritization based on condition severity, insurance, urgency, and treatment history
- **Multi-condition support** — Patients can report multiple conditions in a single intake

### 📋 Coordinator Dashboard
- **Kanban board** — Visual pipeline with drag-and-drop lead management across queues (New, Contacted, Scheduled, Consultation, Converted, Closed)
- **Queue sidebar** — Quick-access queue navigation with real-time counts
- **Lead detail & edit modals** — Full lead profile view with inline editing
- **Consultation panel** — Record consultation outcomes (Complete, Reschedule, Follow-up, No Show, Cancelled)
- **Schedule modal** — Appointment scheduling with date/time picker
- **Quick action panel** — One-click status transitions and communication triggers

### 📊 Analytics & Reporting
- **Analytics dashboard** — KPI cards, lead trend charts, cohort retention analysis, condition breakdown
- **Call analytics** — CallRail integration with call metrics, activity tracking, attribution analysis
- **Platform analytics** — Multi-channel source tracking and conversion attribution
- **Provider performance** — Provider-level metrics and outcome tracking

### 📞 Communications
- **SMS integration** — Twilio-powered SMS compose and delivery
- **Email system** — HIPAA-compliant email via Paubox with branded templates
- **Call tracking** — Inbound/outbound call logging and analytics

### 👥 User & Provider Management
- **Role-based access** — Admin, Coordinator, and Provider roles with granular permissions
- **Invitation flow** — Secure user onboarding with email invitations
- **Password reset** — Token-based secure password recovery
- **Provider dashboard** — Referring provider management with specialty tracking and notes history

### 🔒 Security & Compliance
- **HIPAA-compliant PHI encryption** — AES-256 encryption for all Protected Health Information
- **JWT authentication** — Secure token-based auth with session management
- **Session expiry handling** — Automatic session timeout with user-friendly re-auth modal
- **Audit logging** — Comprehensive audit trail for all data modifications
- **Soft delete** — Data preservation with recoverable deletion (Deleted Leads dashboard)

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** + **TypeScript** | UI framework with type safety |
| **Tailwind CSS** | Utility-first styling |
| **Vite** | Build tool with HMR |
| **React Router** | Client-side routing |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** | High-performance async Python API |
| **SQLAlchemy** | ORM with PostgreSQL |
| **Pydantic** | Request/response validation |
| **Uvicorn** | ASGI server |
| **Celery** | Async task processing |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary database |
| **Docker Compose** | Multi-container orchestration |
| **Nginx** | Frontend static serving & reverse proxy |
| **Redis** | Caching & Celery broker |

### Integrations
| Service | Purpose |
|---------|---------|
| **Twilio** | SMS & Voice |
| **Paubox** | HIPAA-compliant email |
| **CallRail** | Call tracking & analytics |
| **Google Ads** | Conversion tracking webhooks |

## Project Structure

```
NeuroReach-AI/
├── backend/
│   ├── src/
│   │   ├── api/            # FastAPI route handlers
│   │   ├── core/           # Auth, config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # Business logic & integrations
│   │   ├── tasks/          # Celery async tasks
│   │   └── utils/          # Utilities & helpers
│   ├── scripts/            # Admin setup scripts
│   ├── static/             # Static assets
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── call-analytics/
│   │   │   ├── common/     # Shared UI components
│   │   │   ├── dashboard/  # Coordinator dashboard components
│   │   │   ├── widget/     # Intake widget steps
│   │   │   └── widget-embed/
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page-level components
│   │   ├── services/       # API service layer
│   │   ├── styles/         # Global CSS
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── database/
│   └── init/               # SQL migration scripts (001-021)
├── scripts/                # Development utility scripts
├── docs/                   # Documentation
└── docker-compose.yml
```

## Getting Started

### Prerequisites
- **Docker** & **Docker Compose**
- **Node.js** 18+ (for local frontend dev)
- **Python** 3.11+ (for local backend dev)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/EvanMaina/NeuroReachAI.git
cd NeuroReachAI

# Configure environment
cp backend/.env.development backend/.env
# Edit backend/.env with your credentials

# Start all services
docker-compose up --build -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Initial Admin Setup

```bash
# Create the first admin user
docker exec -it neuroreach-backend python -m scripts.setup_fresh_admin
```

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `PHI_ENCRYPTION_KEY` | AES-256 key for PHI encryption |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token |
| `PAUBOX_API_KEY` | Paubox HIPAA email API key |
| `CALLRAIL_API_KEY` | CallRail analytics API key |
| `GOOGLE_ADS_API_KEY` | Google Ads conversion tracking |

## API Documentation

Once the backend is running, interactive API docs are available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## Database Migrations

The database schema is managed through sequential SQL migration scripts in `database/init/`. Migrations run automatically on first container startup. Key migrations include:

| Migration | Description |
|-----------|-------------|
| `001` | Initial schema (leads, providers) |
| `002` | Scheduling & contact outcomes |
| `009` | User management & RBAC |
| `010` | Multi-condition intake support |
| `015` | Scale optimizations for millions of records |
| `016-017` | Invitation flow & password reset |
| `019` | Production performance indexes |
| `020` | Lead notes & follow-up tracking |
| `021` | Stale tag cleanup |

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | **Production** — Protected. Only tested & verified code. |
| `dev` | **Development** — Active development branch. All work happens here. |

> All future work happens on `dev`. We merge to `main` only when changes are tested and verified.

## License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built for <strong>TMS Institute of Arizona</strong>
</p>
