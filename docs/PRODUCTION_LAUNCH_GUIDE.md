# NeuroReach AI -- Production Launch Guide

Complete playbook for deploying NeuroReach AI to a production environment.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [External Platform Accounts](#external-platform-accounts)
5. [Deployment Steps](#deployment-steps)
6. [Creating the Primary Admin](#creating-the-primary-admin)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Switching Environments](#switching-environments)
9. [Backup and Recovery](#backup-and-recovery)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

NeuroReach AI is a multi-container Docker application with the following services:

| Service         | Description                                   | Port  |
|-----------------|-----------------------------------------------|-------|
| db              | PostgreSQL 14 (primary datastore)             | 5432  |
| redis           | Redis 7 (cache, Celery broker, result store)  | 6379  |
| backend         | FastAPI (REST API, static files, webhooks)     | 8000  |
| frontend        | React/Vite (dashboard SPA)                    | 5173  |
| celery-worker   | Celery worker (async lead processing)         | --    |
| celery-beat     | Celery beat (scheduled tasks)                 | --    |
| elasticsearch   | Elasticsearch 8 (full-text search, optional)  | 9200  |
| smsdev          | Local SMS capture server (dev only)           | 1081  |
| maildev         | Local email capture server (dev only)         | 1080  |
| flower          | Celery monitoring dashboard (optional)        | 5555  |

In production, remove or disable: `smsdev`, `maildev`, `flower`.

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A domain name with DNS pointing to your server
- TLS certificate (use Let's Encrypt / Caddy / nginx reverse proxy)
- At least 4 GB RAM, 2 CPU cores
- Accounts for external platforms (see below)

---

## Environment Configuration

The application reads all configuration from a single file: `backend/.env`.

Two source files are provided:

| File                       | Purpose                                    |
|----------------------------|--------------------------------------------|
| `backend/.env.development` | Working dev values (copy to .env for dev)  |
| `backend/.env.production`  | Placeholder template (copy to .env for prod)|

### How to switch environments

```bash
# For development:
cp backend/.env.development backend/.env

# For production:
cp backend/.env.production backend/.env
# Then edit backend/.env and replace all REPLACE_* placeholders
```

The `backend/.env` file is gitignored and never committed.

### Variable Summary

**Developer/Application Variables (21):**

| Variable                     | Required | Description                              |
|------------------------------|----------|------------------------------------------|
| ENVIRONMENT                  | Yes      | "development" or "production"            |
| DEBUG                        | No       | Enable debug mode (false in prod)        |
| APP_NAME                     | No       | Application display name                 |
| APP_VERSION                  | No       | Application version string               |
| HOST                         | No       | Server bind address                      |
| PORT                         | No       | Server bind port                         |
| DATABASE_URL                 | Yes      | PostgreSQL connection string             |
| DB_POOL_SIZE                 | No       | Database connection pool size            |
| DB_MAX_OVERFLOW              | No       | Max overflow connections                 |
| SECRET_KEY                   | Yes      | JWT signing key (must be strong)         |
| ENCRYPTION_KEY               | Yes      | AES-256 key for PHI (exactly 32 bytes)   |
| ACCESS_TOKEN_EXPIRE_MINUTES  | No       | JWT access token lifetime                |
| REFRESH_TOKEN_EXPIRE_DAYS    | No       | JWT refresh token lifetime               |
| CORS_ORIGINS                 | Yes      | Allowed frontend origins (comma-sep)     |
| RATE_LIMIT_PER_MINUTE        | No       | API rate limit                           |
| RATE_LIMIT_BURST             | No       | Rate limit burst allowance               |
| SERVICE_AREA_ZIP_PREFIXES    | No       | ZIP prefixes for service area filtering  |
| LOG_LEVEL                    | No       | Logging level (WARNING for prod)         |
| LOG_FORMAT                   | No       | Log output format (json)                 |
| REDIS_URL                    | Yes      | Redis connection URL                     |
| CELERY_BROKER_URL            | Yes      | Celery broker Redis URL                  |
| CELERY_RESULT_BACKEND        | Yes      | Celery result backend Redis URL          |

**External Platform Variables (22):**

| Variable                     | Platform   | Required     | Description                         |
|------------------------------|------------|--------------|-------------------------------------|
| EMAIL_MODE                   | Email      | Yes          | "maildev" or "paubox"               |
| SMTP_HOST                    | Email      | Dev only     | SMTP server host                    |
| SMTP_PORT                    | Email      | Dev only     | SMTP server port                    |
| FROM_EMAIL                   | Email      | Yes          | Sender email address                |
| FROM_NAME                    | Email      | No           | Sender display name                 |
| SUPPORT_PHONE                | Email      | No           | Phone shown in emails               |
| EMAIL_LOGO_URL               | Email      | Yes          | Public URL to email logo            |
| PAUBOX_ENABLED               | Paubox     | Prod only    | Enable Paubox HIPAA email           |
| PAUBOX_API_KEY               | Paubox     | Prod only    | Paubox API key                      |
| PAUBOX_API_USERNAME           | Paubox     | Prod only    | Paubox account username             |
| PAUBOX_API_BASE_URL          | Paubox     | Prod only    | Paubox API endpoint                 |
| PAUBOX_FROM_EMAIL            | Paubox     | Prod only    | Paubox verified sender              |
| SMS_MODE                     | SMS        | Yes          | "local" or "twilio"                 |
| TWILIO_ACCOUNT_SID           | Twilio     | Prod only    | Twilio Account SID                  |
| TWILIO_AUTH_TOKEN             | Twilio     | Prod only    | Twilio Auth Token                   |
| TWILIO_PHONE_NUMBER          | Twilio     | Prod only    | Twilio outbound phone number        |
| CALLRAIL_API_KEY             | CallRail   | Yes          | CallRail API key                    |
| CALLRAIL_ACCOUNT_ID          | CallRail   | Yes          | CallRail account ID                 |
| CALLRAIL_COMPANY_ID          | CallRail   | Yes          | CallRail company ID                 |
| GOOGLE_ADS_WEBHOOK_KEY       | Google Ads | Optional     | Webhook verification secret         |
| GOOGLE_ADS_DEVELOPER_TOKEN   | Google Ads | Optional     | Google Ads API dev token            |
| GOOGLE_ADS_CUSTOMER_ID       | Google Ads | Optional     | Google Ads customer ID              |

---

## External Platform Accounts

You need accounts with these 4 external platforms:

### 1. Paubox (HIPAA-Compliant Email)

- Website: https://www.paubox.com
- Purpose: Sends HIPAA-compliant patient emails
- What you need: API key, username, verified sender email
- Cost: Paid plan required for production volume

### 2. Twilio (SMS)

- Website: https://console.twilio.com
- Purpose: Outbound SMS to patients and coordinators
- What you need: Account SID, Auth Token, phone number
- Cost: Pay-per-message pricing

### 3. CallRail (Call Analytics)

- Website: https://app.callrail.com
- Purpose: Call tracking and analytics integration
- What you need: API key, Account ID, Company ID
- Where to find: Settings -> API Access in CallRail dashboard

### 4. Google Ads (Optional)

- Website: https://ads.google.com
- Purpose: Lead form extension webhook integration
- What you need: Webhook key for verification, optional API credentials
- Note: Only required if using Google Ads lead forms

---

## Deployment Steps

### Step 1: Clone and configure

```bash
git clone https://github.com/your-org/NeuroReach-AI.git
cd NeuroReach-AI

# Create production .env
cp backend/.env.production backend/.env

# Edit and fill in all REPLACE_* values
nano backend/.env
```

### Step 2: Review docker-compose.yml

For production, consider:

- Removing the `smsdev`, `maildev`, and `flower` services
- Adding a reverse proxy (nginx/Caddy) for TLS termination
- Adjusting resource limits for your server capacity
- Setting `FRONTEND_PORT` and `BACKEND_PORT` if needed

### Step 3: Build and start

```bash
docker compose build --no-cache
docker compose up -d
```

### Step 4: Verify all services are healthy

```bash
docker compose ps
# All services should show "healthy" or "running"

curl http://localhost:8000/health/live
# Should return: {"status": "ok"}
```

### Step 5: Create the primary admin account

```bash
docker exec -it neuroreach-backend python /app/scripts/setup_fresh_admin.py \
  --email admin@yourclinic.com \
  --role primary_admin
```

This will:
- Clear any seed admin accounts
- Create a primary admin with a temporary password
- Print the temporary password to the console
- Send an invitation email (if email is configured)

### Step 6: Log in and secure

1. Navigate to your frontend URL
2. Log in with the email and temporary password
3. Set a strong permanent password when prompted
4. Create additional administrator/coordinator accounts from Settings

---

## Creating the Primary Admin

The `setup_fresh_admin.py` script supports these flags:

```
--email EMAIL    (required) The admin's email address
--role ROLE      (optional) One of: primary_admin, administrator, coordinator, specialist
                 Default: primary_admin
```

### Role Hierarchy

| Role            | Can manage                              | Can be deactivated by |
|-----------------|----------------------------------------|-----------------------|
| primary_admin   | All users, all settings, all data       | No one (protected)    |
| administrator   | Coordinators, specialists, settings     | Primary admin only    |
| coordinator     | Leads, providers, scheduling            | Any admin             |
| specialist      | View-only access                        | Any admin             |

The primary_admin role has all administrator permissions plus:
- Cannot be deactivated or demoted by anyone (self-protection)
- Can deactivate other administrators
- Only one primary_admin should exist per deployment

---

## Post-Deployment Verification

Run through this checklist after deployment:

- [ ] `docker compose ps` shows all services healthy
- [ ] `curl /health/live` returns status ok
- [ ] Frontend loads at your domain
- [ ] Login works with the admin credentials
- [ ] Settings page loads and shows the admin user
- [ ] Email test: create a new user and verify invitation email arrives
- [ ] SMS test: send a test SMS from a lead record
- [ ] Call Analytics: verify CallRail data loads
- [ ] Widget: embed the intake widget on a test page and submit
- [ ] Logo: check that emails display the logo correctly

---

## Switching Environments

The app always reads from `backend/.env`. To switch:

```bash
# Switch to development:
cp backend/.env.development backend/.env
docker compose down && docker compose up -d --build

# Switch to production:
cp backend/.env.production backend/.env
# Edit backend/.env to fill in real values
docker compose down && docker compose up -d --build
```

The `.env.development` and `.env.production` files are source templates.
They are gitignored and should be managed separately for each environment.

---

## Backup and Recovery

### Database backup

```bash
docker exec neuroreach-db pg_dump -U neuroreach neuroreach > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
cat backup_20260213.sql | docker exec -i neuroreach-db psql -U neuroreach neuroreach
```

### Redis data

Redis is used for caching only. No backup required -- data is regenerated on restart.

---

## Troubleshooting

### App refuses to start in production

The app validates `SECRET_KEY` and `ENCRYPTION_KEY` at startup. If they still
contain dev defaults ("dev-secret-key-change-in-production"), the app will
print a FATAL error and exit. Generate strong values:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

### Email logo not showing

Verify `EMAIL_LOGO_URL` is set to a publicly accessible URL. Test by opening
the URL directly in a browser. The backend serves the logo at
`/static/images/logo.png` without authentication.

### Database connection errors

Check that `DATABASE_URL` uses the correct hostname. In Docker,
`docker-compose.yml` overrides this to use the `db` container hostname.
For external databases, use the full connection string.

### SMS not sending

Verify `SMS_MODE=twilio` and that all three Twilio credentials are set.
Check Twilio dashboard for delivery logs. In development, use `SMS_MODE=local`
with the smsdev container.
