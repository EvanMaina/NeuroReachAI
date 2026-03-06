# 📘 NeuroReach AI — Operations Runbook

**Last Updated:** 2026-03-06  
**Version:** 1.8.0  
**Maintained by:** Deployment Engineering

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Deployment](#2-deployment)
3. [Rollback](#3-rollback)
4. [Monitoring & Alerts Dashboard](#4-monitoring--alerts-dashboard)
5. [Health Checks](#5-health-checks)
6. [Viewing Logs](#6-viewing-logs)
7. [Scaling](#7-scaling)
8. [Backups & Restore](#8-backups--restore)
9. [Secret Rotation](#9-secret-rotation)
10. [Staging Environment](#10-staging-environment)
11. [Troubleshooting](#11-troubleshooting)
12. [Emergency Procedures](#12-emergency-procedures)

---

## 1. Quick Reference

### URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production App** | `https://app.tmsinstitute.co` | Frontend dashboard |
| **Production API** | `https://api.tmsinstitute.co` | Backend API |
| **Staging App** | `https://app-staging.tmsinstitute.co` | Staging frontend (requires DNS CNAME) |
| **Staging API** | `https://app-staging.tmsinstitute.co` | Staging backend API |
| **Widget** | `https://api.tmsinstitute.co/widget-embed.js` | Embeddable intake widget |
| **Assessment** | `https://api.tmsinstitute.co/assessment` | Standalone assessment page |

### AWS Console Quick Links

| Resource | Console URL |
|----------|------------|
| **ECS Cluster** | `https://us-east-2.console.aws.amazon.com/ecs/v2/clusters/neuroreach-ai-cluster/services` |
| **CloudWatch Dashboard** | `https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards/dashboard/NeuroReach-AI-Production` |
| **CloudWatch Alarms** | `https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#alarmsV2:` |
| **CloudWatch Logs** | `https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#logsV2:log-groups` |
| **RDS Database** | `https://us-east-2.console.aws.amazon.com/rds/home?region=us-east-2#database:id=neuroreach-ai-db` |
| **ECR Images** | `https://us-east-2.console.aws.amazon.com/ecr/repositories/private/131880217305/neuroreach-ai/backend` |
| **ALB** | `https://us-east-2.console.aws.amazon.com/ec2/home?region=us-east-2#LoadBalancers:` |
| **SNS Alerts** | `https://us-east-2.console.aws.amazon.com/sns/v3/home?region=us-east-2#/topic/arn:aws:sns:us-east-2:131880217305:neuroreach-ai-alerts` |
| **S3 Backups** | `https://s3.console.aws.amazon.com/s3/buckets/neuroreach-backups-prod` |

### Key AWS Identifiers

| Resource | Identifier |
|----------|------------|
| AWS Account | `131880217305` |
| Region | `us-east-2` (Ohio) |
| ECS Cluster | `neuroreach-ai-cluster` |
| Production Backend Service | `neuroreach-ai-backend-service` |
| Production Celery Service | `neuroreach-ai-celery-service` |
| Staging Backend Service | `neuroreach-staging-backend-service` |
| Staging Celery Service | `neuroreach-staging-celery-service` |
| ECR Repository | `131880217305.dkr.ecr.us-east-2.amazonaws.com/neuroreach-ai/backend` |
| ALB DNS | `neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com` |
| Production RDS | `neuroreach-ai-db.cfggkciq6tun.us-east-2.rds.amazonaws.com` |
| Staging RDS | `neuroreach-staging-db.cfggkciq6tun.us-east-2.rds.amazonaws.com` |
| Production Redis | `master.neuroreach-ai-redis-v2.1kihud.use2.cache.amazonaws.com:6379` |
| Staging Redis | `master.neuroreach-staging-redis.1kihud.use2.cache.amazonaws.com:6379` |

---

## 2. Deployment

### 2.1 Automatic Deployment (CI/CD)

Deployments are fully automated via GitHub Actions:

| Branch | Trigger | Pipeline | Workflow File |
|--------|---------|----------|---------------|
| `main` | Push/merge | Deploy to Production | `.github/workflows/deploy-production.yml` |
| `staging` | Push/merge | Deploy to Staging | `.github/workflows/deploy-staging.yml` |
| Any | Pull Request | CI Checks only | `.github/workflows/ci.yml` |

**Standard deployment flow:**

```
1. Developer pushes to `dev` branch
2. Creates PR from `dev` → `staging`
3. CI checks run automatically (lint, type check, tests, security scan, Docker build)
4. After review + merge → staging pipeline deploys
5. Verify on staging
6. Creates PR from `staging` → `main`
7. After review + merge → production pipeline deploys
8. Smoke tests verify production health
9. Git release tag created automatically
```

**What the pipeline does:**

1. **Build frontend** (Vite: main app + widget + assessment bundles)
2. **Copy bundles to backend** directory
3. **Build Docker image** (multi-stage: builder → production)
4. **Security scan** with Trivy (vulnerabilities)
5. **Push to ECR** (tagged: `prod-{sha}` or `staging-{sha}` + `*-latest`)
6. **Update ECS task definition** with new image
7. **Deploy to ECS** (rolling update with health checks)
8. **Run smoke tests** (health endpoints)
9. **Tag release** (production only)

### 2.2 Manual Deployment (Emergency)

If CI/CD is unavailable, deploy manually:

```bash
# 1. Build frontend
cd frontend && npm ci && npm run build && npm run build:widget && npm run build:assessment && cd ..

# 2. Copy bundles
mkdir -p backend/frontend-bundles/{dist,dist-widget,dist-assessment}
cp -r frontend/dist/* backend/frontend-bundles/dist/
cp -r frontend/dist-widget/* backend/frontend-bundles/dist-widget/
cp -r frontend/dist-assessment/* backend/frontend-bundles/dist-assessment/

# 3. Build Docker image
cd backend
docker build --target production -t 131880217305.dkr.ecr.us-east-2.amazonaws.com/neuroreach-ai/backend:manual-$(date +%Y%m%d) -f Dockerfile .

# 4. Login to ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 131880217305.dkr.ecr.us-east-2.amazonaws.com

# 5. Push
docker push 131880217305.dkr.ecr.us-east-2.amazonaws.com/neuroreach-ai/backend:manual-$(date +%Y%m%d)

# 6. Update ECS service (force new deployment)
aws ecs update-service --cluster neuroreach-ai-cluster --service neuroreach-ai-backend-service --force-new-deployment --region us-east-2
aws ecs update-service --cluster neuroreach-ai-cluster --service neuroreach-ai-celery-service --force-new-deployment --region us-east-2
```

### 2.3 Viewing Deployment Status

```bash
# List recent pipeline runs
gh run list --repo EvanMaina/NeuroReachAI --limit 10

# View specific run details
gh run view <RUN_ID> --repo EvanMaina/NeuroReachAI

# View failed step logs
gh run view <RUN_ID> --log-failed --repo EvanMaina/NeuroReachAI

# Watch a running pipeline
gh run watch <RUN_ID> --repo EvanMaina/NeuroReachAI --exit-status
```

---

## 3. Rollback

### 3.1 One-Click Rollback (GitHub Actions)

Use the rollback workflow via GitHub Actions UI:

1. Go to: `https://github.com/EvanMaina/NeuroReachAI/actions/workflows/rollback.yml`
2. Click **"Run workflow"**
3. Choose rollback type:
   - `previous-revision` — Reverts to the previous ECS task definition
   - `specific-image` — Deploys a specific ECR image tag (e.g., `prod-18513d3`)
4. Choose scope: `both`, `backend-only`, or `celery-only`
5. Type `ROLLBACK` in the confirmation field
6. Click **"Run workflow"**

### 3.2 CLI Rollback

```bash
# Get current task definition revisions
aws ecs describe-services --cluster neuroreach-ai-cluster \
  --services neuroreach-ai-backend-service \
  --query "services[0].taskDefinition" --output text --region us-east-2

# List task definition revisions
aws ecs list-task-definitions --family-prefix neuroreach-ai-backend \
  --sort DESC --max-items 5 --region us-east-2

# Rollback to specific revision
aws ecs update-service --cluster neuroreach-ai-cluster \
  --service neuroreach-ai-backend-service \
  --task-definition neuroreach-ai-backend:<REVISION_NUMBER> \
  --region us-east-2

# Wait for deployment
aws ecs wait services-stable --cluster neuroreach-ai-cluster \
  --services neuroreach-ai-backend-service --region us-east-2
```

### 3.3 Verify After Rollback

```bash
# Check production health
curl -s https://api.tmsinstitute.co/health | python -m json.tool

# Check which image is running
aws ecs describe-services --cluster neuroreach-ai-cluster \
  --services neuroreach-ai-backend-service \
  --query "services[0].deployments[0].taskDefinition" --output text --region us-east-2
```

---

## 4. Monitoring & Alerts Dashboard

### 4.1 Accessing the CloudWatch Dashboard

**Direct URL:**
```
https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards/dashboard/NeuroReach-AI-Production
```

**Via AWS Console:**
1. Go to AWS Console → CloudWatch
2. Left sidebar → **Dashboards**
3. Click **"NeuroReach-AI-Production"**

The dashboard has **22 widgets** organized in 4 sections:

| Section | Widgets | What It Shows |
|---------|---------|---------------|
| **🚨 Alarm Status** | 1 | All 13 alarms at a glance (OK/ALARM/INSUFFICIENT_DATA) |
| **📦 ECS Services** | 5 | CPU/Memory utilization, running vs desired tasks, pending tasks |
| **🌐 ALB** | 6 | Request count, HTTP status codes, response time, target health, connections |
| **🗃️ RDS Database** | 10 | CPU, storage, connections, IOPS, latency, memory, swap |

### 4.2 Accessing CloudWatch Alarms

**Direct URL:**
```
https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#alarmsV2:
```

**Via AWS Console:**
1. Go to AWS Console → CloudWatch
2. Left sidebar → **Alarms** → **All alarms**

### 4.3 Active Alarms (13 Total)

| # | Alarm Name | Trigger Condition | Severity |
|---|-----------|-------------------|----------|
| 1 | `neuroreach-backend-cpu-high` | Backend CPU > 80% for 5 min | 🔴 Critical |
| 2 | `neuroreach-backend-memory-high` | Backend Memory > 80% for 5 min | 🔴 Critical |
| 3 | `neuroreach-backend-service-degraded` | Running tasks < desired for 5 min | 🔴 Critical |
| 4 | `neuroreach-celery-cpu-high` | Celery CPU > 80% for 5 min | 🟡 Warning |
| 5 | `neuroreach-celery-memory-high` | Celery Memory > 80% for 5 min | 🟡 Warning |
| 6 | `neuroreach-celery-service-degraded` | Running tasks < desired for 5 min | 🟡 Warning |
| 7 | `neuroreach-alb-5xx-errors` | ALB 5xx count > 10 in 5 min | 🔴 Critical |
| 8 | `neuroreach-target-5xx-errors` | Target 5xx count > 10 in 5 min | 🔴 Critical |
| 9 | `neuroreach-alb-response-time-high` | P99 latency > 5s for 5 min | 🟡 Warning |
| 10 | `neuroreach-alb-unhealthy-hosts` | Unhealthy host count > 0 for 5 min | 🔴 Critical |
| 11 | `neuroreach-rds-cpu-high` | RDS CPU > 80% for 10 min | 🔴 Critical |
| 12 | `neuroreach-rds-storage-low` | Free storage < 5 GB | 🔴 Critical |
| 13 | `neuroreach-rds-connections-high` | DB connections > 80 for 5 min | 🟡 Warning |

### 4.4 Alert Notifications (SNS)

All alarms send to the **`neuroreach-ai-alerts`** SNS topic.

**To subscribe to alerts (email):**

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:131880217305:neuroreach-ai-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-2
```

**To subscribe to alerts (SMS):**

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:131880217305:neuroreach-ai-alerts \
  --protocol sms \
  --notification-endpoint +1234567890 \
  --region us-east-2
```

**To view current subscribers:**

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-2:131880217305:neuroreach-ai-alerts \
  --region us-east-2
```

### 4.5 Viewing Alarm History

```bash
# View alarm state history
aws cloudwatch describe-alarm-history \
  --alarm-name neuroreach-backend-cpu-high \
  --history-item-type StateUpdate \
  --max-items 10 \
  --region us-east-2

# List all alarms in ALARM state
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix neuroreach \
  --region us-east-2
```

---

## 5. Health Checks

### 5.1 Quick Health Check (30 seconds)

```bash
# Production API health
curl -s https://api.tmsinstitute.co/health | python -m json.tool

# Production liveness
curl -s https://api.tmsinstitute.co/health/live

# Staging health (via ALB direct)
curl -sk https://neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com/health \
  -H "Host: app-staging.tmsinstitute.co" | python -m json.tool

# Frontend check
curl -s -o /dev/null -w "%{http_code}" https://app.tmsinstitute.co
```

**Expected health response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-06T12:30:34.881390",
  "database": "connected",
  "environment": "production"
}
```

### 5.2 Full System Verification

```bash
# ECS service status
aws ecs describe-services --cluster neuroreach-ai-cluster \
  --services neuroreach-ai-backend-service neuroreach-ai-celery-service \
  --query "services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount}" \
  --output table --region us-east-2

# ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-2:131880217305:targetgroup/neuroreach-ai-backend-tg/YOUR_TG_ARN \
  --region us-east-2

# RDS status
aws rds describe-db-instances --db-instance-identifier neuroreach-ai-db \
  --query "DBInstances[0].{Status:DBInstanceStatus,CPU:PercentageCPUUtilization}" \
  --output table --region us-east-2
```

---

## 6. Viewing Logs

### 6.1 CloudWatch Logs Console

| Log Group | Purpose |
|-----------|---------|
| `/ecs/neuroreach-ai-backend` | Production backend API logs |
| `/ecs/neuroreach-ai-celery` | Production Celery worker logs |
| `/ecs/neuroreach-staging-backend` | Staging backend API logs |
| `/ecs/neuroreach-staging-celery` | Staging Celery worker logs |

**Via AWS Console:**
1. Go to CloudWatch → Log groups
2. Click the relevant log group
3. Click the most recent log stream

### 6.2 CLI Log Access

```bash
# Last 30 minutes of backend logs
aws logs filter-log-events \
  --log-group-name /ecs/neuroreach-ai-backend \
  --start-time $(python -c "import time; print(int((time.time()-1800)*1000))") \
  --region us-east-2 \
  --no-paginate

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/neuroreach-ai-backend \
  --filter-pattern "ERROR" \
  --start-time $(python -c "import time; print(int((time.time()-3600)*1000))") \
  --region us-east-2

# Tail logs in real-time (requires aws-cli v2)
aws logs tail /ecs/neuroreach-ai-backend --follow --region us-east-2

# Staging backend logs
aws logs filter-log-events \
  --log-group-name /ecs/neuroreach-staging-backend \
  --start-time $(python -c "import time; print(int((time.time()-1800)*1000))") \
  --region us-east-2 \
  --no-paginate
```

---

## 7. Scaling

### 7.1 Current Auto-Scaling Configuration

| Service | Min | Max | CPU Target | Memory Target |
|---------|-----|-----|------------|---------------|
| Backend | 2 | 6 | 70% | 75% |
| Celery | 2 | 4 | 70% | 75% |
| Staging Backend | 1 | 1 | N/A | N/A |
| Staging Celery | 1 | 1 | N/A | N/A |

### 7.2 Manual Scaling

```bash
# Scale production backend to 4 instances
aws ecs update-service --cluster neuroreach-ai-cluster \
  --service neuroreach-ai-backend-service \
  --desired-count 4 --region us-east-2

# Scale celery workers to 3
aws ecs update-service --cluster neuroreach-ai-cluster \
  --service neuroreach-ai-celery-service \
  --desired-count 3 --region us-east-2

# Scale down after peak
aws ecs update-service --cluster neuroreach-ai-cluster \
  --service neuroreach-ai-backend-service \
  --desired-count 2 --region us-east-2
```

### 7.3 Modify Auto-Scaling Limits

```bash
# Update min/max capacity for backend
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/neuroreach-ai-cluster/neuroreach-ai-backend-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 --max-capacity 8 \
  --region us-east-2
```

---

## 8. Backups & Restore

### 8.1 Backup Schedule

| Backup Type | Schedule | Retention | Storage |
|-------------|----------|-----------|---------|
| RDS Automated Snapshots | Daily 02:00-02:30 UTC | 35 days | AWS RDS |
| RDS Point-in-Time Recovery | Continuous | 35 days | AWS RDS |
| ElastiCache Snapshots | Daily | 7 days | AWS ElastiCache |
| Database pg_dump | Daily 02:00 UTC | 90 days | S3 `neuroreach-backups-prod` |
| Database pg_dump (weekly) | Sunday 04:00 UTC | 1 year | S3 `neuroreach-backups-prod` |

### 8.2 Manual Database Backup

```bash
# Trigger manual RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier neuroreach-ai-db \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d) \
  --region us-east-2

# Trigger backup workflow
gh workflow run backup.yml --repo EvanMaina/NeuroReachAI
```

### 8.3 Restore from RDS Snapshot

```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier neuroreach-ai-db \
  --query "DBSnapshots[*].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}" \
  --output table --region us-east-2

# Restore to a new instance (DO NOT overwrite production)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier neuroreach-ai-db-restored \
  --db-snapshot-identifier <SNAPSHOT_ID> \
  --region us-east-2
```

### 8.4 Point-in-Time Recovery

```bash
# Restore to specific point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier neuroreach-ai-db \
  --target-db-instance-identifier neuroreach-ai-db-pitr \
  --restore-time "2026-03-06T10:00:00Z" \
  --region us-east-2
```

### 8.5 View Backup Files in S3

```bash
# List recent backups
aws s3 ls s3://neuroreach-backups-prod/rds/daily/ --region us-east-2
aws s3 ls s3://neuroreach-backups-prod/rds/weekly/ --region us-east-2
```

---

## 9. Secret Rotation

### 9.1 Where Secrets Are Stored

| Secret | Storage Location |
|--------|------------------|
| AWS Credentials (CI/CD) | GitHub Repository Secrets |
| Database URL | ECS Task Definition env vars |
| Redis URL | ECS Task Definition env vars |
| SECRET_KEY (JWT) | ECS Task Definition env vars |
| ENCRYPTION_KEY (PHI) | ECS Task Definition env vars |
| Paubox API Key | ECS Task Definition env vars |
| Twilio Auth Token | ECS Task Definition env vars |
| CallRail API Key | ECS Task Definition env vars |

### 9.2 Rotating the JWT Secret Key

1. Generate new key: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Update ECS task definition with new `SECRET_KEY` value
3. Deploy new task definition revision
4. **Note:** All existing user sessions will be invalidated (users must re-login)

### 9.3 Rotating the Encryption Key

⚠️ **WARNING:** Changing `ENCRYPTION_KEY` will make existing encrypted PHI data unreadable. This requires a data migration.

1. Generate new key: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Write a migration script to decrypt all PHI with old key and re-encrypt with new key
3. Run migration during maintenance window
4. Update task definition with new key
5. Deploy and verify

### 9.4 Rotating Database Password

```bash
# 1. Change password in RDS
aws rds modify-db-instance \
  --db-instance-identifier neuroreach-ai-db \
  --master-user-password NEW_PASSWORD \
  --region us-east-2

# 2. Update DATABASE_URL in task definition with new password
# 3. Register new task definition revision
# 4. Deploy new revision
```

---

## 10. Staging Environment

### 10.1 Staging Infrastructure

| Component | Resource | Specs |
|-----------|----------|-------|
| Backend | `neuroreach-staging-backend-service` | 1 instance, 256 CPU / 512 MB |
| Celery | `neuroreach-staging-celery-service` | 1 instance, 256 CPU / 512 MB |
| Database | `neuroreach-staging-db` | db.t3.micro, PostgreSQL 14, 20GB |
| Redis | `neuroreach-staging-redis` | cache.t3.micro, Redis 7.1, non-cluster |
| URL | `https://app-staging.tmsinstitute.co` | Via ALB host-based routing |

### 10.2 Accessing Staging Before DNS Setup

Until the CNAME record for `app-staging.tmsinstitute.co` is created at the domain provider, you can access staging via:

**Option 1: Edit local hosts file (browser access)**

1. Get ALB IP: `nslookup neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com`
2. Edit `C:\Windows\System32\drivers\etc\hosts` (as Administrator):
   ```
   <ALB_IP>  app-staging.tmsinstitute.co
   ```
3. Browse to `https://app-staging.tmsinstitute.co`

**Option 2: curl with Host header (API testing)**

```bash
# Health check
curl -sk https://neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com/health \
  -H "Host: app-staging.tmsinstitute.co"

# API call
curl -sk https://neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com/api/auth/login \
  -H "Host: app-staging.tmsinstitute.co" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### 10.3 Setting Up DNS (Permanent)

At your domain provider's DNS management (GoDaddy, Namecheap, Cloudflare, etc.):

```
Type:   CNAME
Name:   app-staging
Value:  neuroreach-ai-alb-1879069977.us-east-2.elb.amazonaws.com
TTL:    300
```

### 10.4 Staging Configuration

Staging has these key differences from production:
- **Email:** `log` mode (emails logged, not sent)
- **SMS:** `log` mode (SMS logged, not sent)
- **Separate database:** `neuroreach_staging` on `neuroreach-staging-db`
- **Separate Redis:** `neuroreach-staging-redis` (non-cluster, TLS)
- **Separate secrets:** Different `SECRET_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`
- **CallRail/Google Ads:** Disabled (dummy keys)

---

## 11. Troubleshooting

### 11.1 Service Not Healthy

```bash
# Check ECS service events (shows deployment failures)
aws ecs describe-services --cluster neuroreach-ai-cluster \
  --services neuroreach-ai-backend-service \
  --query "services[0].events[:5]" --output table --region us-east-2

# Check task failures
aws ecs list-tasks --cluster neuroreach-ai-cluster \
  --service-name neuroreach-ai-backend-service \
  --desired-status STOPPED --region us-east-2

# Get stopped task reason
aws ecs describe-tasks --cluster neuroreach-ai-cluster \
  --tasks <TASK_ARN> \
  --query "tasks[0].{status:lastStatus,reason:stoppedReason,exitCode:containers[0].exitCode}" \
  --region us-east-2
```

### 11.2 High CPU / Memory

1. Check CloudWatch Dashboard → ECS Services section
2. If auto-scaling hasn't kicked in, manually scale:
   ```bash
   aws ecs update-service --cluster neuroreach-ai-cluster \
     --service neuroreach-ai-backend-service \
     --desired-count 4 --region us-east-2
   ```
3. Check logs for runaway queries or memory leaks

### 11.3 Database Connection Issues

```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier neuroreach-ai-db \
  --query "DBInstances[0].{Status:DBInstanceStatus,Connections:Endpoint}" \
  --region us-east-2

# Check connection count from CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=neuroreach-ai-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Maximum \
  --region us-east-2
```

### 11.4 5xx Errors on ALB

```bash
# Check ALB access logs
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/neuroreach-ai-alb/09820aa0f84e6f0b \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Sum \
  --region us-east-2

# Check backend logs for errors
aws logs filter-log-events \
  --log-group-name /ecs/neuroreach-ai-backend \
  --filter-pattern "ERROR" \
  --start-time $(python -c "import time; print(int((time.time()-3600)*1000))") \
  --region us-east-2
```

### 11.5 Pipeline Failures

```bash
# View failed run logs
gh run view <RUN_ID> --log-failed --repo EvanMaina/NeuroReachAI

# Re-run failed jobs
gh run rerun <RUN_ID> --failed --repo EvanMaina/NeuroReachAI
```

---

## 12. Emergency Procedures

### 12.1 Production Down — Immediate Actions

1. **Check health:** `curl -s https://api.tmsinstitute.co/health`
2. **Check ECS services:** Are tasks running?
   ```bash
   aws ecs describe-services --cluster neuroreach-ai-cluster \
     --services neuroreach-ai-backend-service \
     --query "services[0].{Running:runningCount,Desired:desiredCount,Events:events[:3]}" \
     --region us-east-2
   ```
3. **Check recent deployment:** Did a recent deploy break something?
   ```bash
   gh run list --repo EvanMaina/NeuroReachAI --limit 5
   ```
4. **Rollback if recent deploy:** Use rollback workflow (Section 3.1)
5. **Check CloudWatch alarms:** Which alarms are firing?
   ```bash
   aws cloudwatch describe-alarms --state-value ALARM \
     --alarm-name-prefix neuroreach --region us-east-2
   ```

### 12.2 Data Breach Response

1. **Immediately rotate** all secrets (Section 9)
2. **Check audit logs** in the database for unauthorized access
3. **Review CloudWatch logs** for suspicious activity
4. **HIPAA notification:** Must notify within 60 days (consult legal)

### 12.3 Database Corruption

1. **Stop all ECS services** to prevent further writes
2. **Create RDS snapshot** of current (corrupted) state for forensics
3. **Restore from latest clean snapshot** (Section 8.3)
4. **Point services to restored instance**
5. **Verify data integrity**

---

*End of Operations Runbook*
