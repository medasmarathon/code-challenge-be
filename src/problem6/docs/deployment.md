# Deployment Specification

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `REDIS_URL` | Redis connection | `redis://...` |
| `JWT_SECRET` | JWT signing key (min 32 chars) | From secrets manager |
| `ACTION_TOKEN_SECRET` | Action token signing key (min 32 chars) | From secrets manager |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `24h` | Access token lifetime |
| `ACTION_TOKEN_TTL` | `300` | Action token validity (seconds) |
| `RATE_LIMIT_SCORE_UPDATE` | `10` | Requests per minute |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `SSE_PING_INTERVAL` | `30000` | SSE keep-alive interval |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `REDIS_SYNC_INTERVAL` | `300000` | Leaderboard sync interval (5 min) |

---

## Infrastructure Requirements

### Minimum (Development/Staging)

| Component | Specification |
|-----------|---------------|
| API Server | 1 instance, 1 vCPU, 512MB RAM |
| PostgreSQL | Single instance, 10GB storage |
| Redis | Single instance, 256MB |

### Production (Recommended)

| Component | Specification |
|-----------|---------------|
| API Server | 2+ instances, 2 vCPU, 1GB RAM each |
| PostgreSQL | Primary + read replica, 100GB SSD |
| Redis | Cluster mode, 1GB per node |
| Load Balancer | Nginx or ALB with sticky sessions for SSE |

### Simplified Production (< 1,000 concurrent users)

| Component | Specification |
|-----------|---------------|
| API Server | 1-2 instances |
| PostgreSQL | Single instance with good specs |
| Redis | Optional - can use PostgreSQL for everything |

---

## Docker Requirements

### Dockerfile Expectations

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
# ... build steps

FROM node:20-alpine
# ... production image
# Must run as non-root user
# Must expose health check endpoint
```

### Health Check

The application MUST expose:

```
GET /health
```

**Response (healthy):**
```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Response (degraded):**
```json
{
  "status": "degraded",
  "checks": {
    "database": "ok",
    "redis": "error"
  }
}
```

HTTP 200 for healthy, HTTP 503 for degraded.

---

## Load Balancer Requirements

### SSE Support

- Must support HTTP keep-alive connections
- Connection timeout: 1 hour minimum
- Sticky sessions recommended for SSE (same user routes to same server)

### SSL/TLS

- TLS 1.2+ required
- Automatic HTTPS redirect
- Valid certificate (not self-signed in production)

---

## Database Setup

### PostgreSQL

1. Create database and user
2. Run migrations in order:
   - users table
   - scores table
   - sessions table
   - score_events table
   - consumed_tokens table
3. Verify indexes created

### Redis

1. Configure `appendonly yes` for persistence
2. Set `maxmemory-policy allkeys-lru`
3. Verify pub/sub works across instances (if clustered)

---

## CloudWatch Integration

### ECS Auto-Logging

When deployed on ECS, logs automatically ship to CloudWatch. No additional configuration needed.

**Log Group:** `/ecs/<service-name>`

### Log Format

Application should output JSON logs:

```json
{
  "timestamp": "2025-12-28T12:00:00.000Z",
  "level": "info",
  "service": "scoreboard-api",
  "requestId": "uuid",
  "userId": "usr_xxx",
  "message": "Score updated",
  "data": { "newScore": 1500 }
}
```

### Required Log Events

| Event | Level | When |
|-------|-------|------|
| Request received | info | Every request |
| Request completed | info | Every response |
| Auth failed | warn | 401 responses |
| Action token rejected | warn | Invalid/expired/replay tokens |
| Rate limit hit | warn | 429 responses |
| Database error | error | DB failures |
| Redis error | error | Redis failures |
| Unhandled exception | error | Crashes |

### CloudWatch Log Insights Queries

**Find score update failures:**
```
fields @timestamp, @message
| filter level = "error" and message like /score/
| sort @timestamp desc
| limit 100
```

**Track action token rejections:**
```
fields @timestamp, userId, @message
| filter level = "warn" and message like /token/
| stats count() by userId
| sort count desc
```

### CloudWatch Alarms (Suggested)

| Metric | Condition | Action |
|--------|-----------|--------|
| Error logs | > 10 per minute | Alert |
| 5xx response rate | > 1% | Alert |
| Action token rejections | > 100 per minute | Investigate abuse |

---

## CI/CD Pipeline Requirements

### On Pull Request

| Step | Purpose |
|------|---------|
| Lint | Code style |
| Type check | TypeScript errors |
| Unit tests | Logic correctness |
| Integration tests | API contracts |

### On Merge to Main

| Step | Purpose |
|------|---------|
| Build Docker image | Create artifact |
| Push to registry | Store artifact |
| Deploy to staging | Verify in staging |
| Run smoke tests | Basic functionality |
| Deploy to production | Release |

### Rollback Trigger

- Error rate > 5% for 5 minutes
- p99 latency > 2 seconds for 5 minutes
- Health check failures > 10% of instances

---

## Monitoring Requirements

### Metrics to Export (Prometheus format)

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, path, status |
| `http_request_duration_seconds` | Histogram | method, path |
| `sse_connections_active` | Gauge | - |
| `score_updates_total` | Counter | status |
| `action_token_validations_total` | Counter | result (valid/invalid/expired/replay) |
| `rate_limit_hits_total` | Counter | endpoint |
| `redis_leaderboard_sync_drift` | Gauge | - |

### Alerts (Suggested)

| Condition | Severity | Action |
|-----------|----------|--------|
| Error rate > 1% (5min) | Warning | Investigate |
| Error rate > 5% (5min) | Critical | Page on-call |
| p99 latency > 1s (5min) | Warning | Investigate |
| SSE connections > 80% capacity | Warning | Scale |
| Action token rejection rate > 5% | Warning | Investigate potential abuse |

---

## Security Checklist for Deployment

- [ ] Secrets in secrets manager (AWS Secrets Manager or Parameter Store)
- [ ] JWT_SECRET and ACTION_TOKEN_SECRET are different values
- [ ] Database credentials rotated quarterly
- [ ] Network isolation (VPC/private subnets)
- [ ] No public database access
- [ ] WAF rules enabled
- [ ] DDoS protection enabled
- [ ] SSL certificate valid and auto-renewed
- [ ] CloudWatch logs encrypted at rest
- [ ] Audit logging to CloudWatch enabled