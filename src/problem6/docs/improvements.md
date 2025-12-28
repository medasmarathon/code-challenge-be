# Future Improvements

This document outlines potential enhancements beyond the initial specification. These are NOT part of the initial implementation scope.

---

## Priority 1: If Abuse Becomes a Problem

### Behavioral Analysis

**When:** Action tokens are being exploited (e.g., compromised action service, automated action completion).

**Signals to Monitor:**
- Timing regularity (bots are too consistent)
- Always maximum score (bots optimize)
- Geographic anomalies
- Device fingerprint patterns
- Action completion speed vs. expected duration

**Response:** Flag for review, temporary suspension, manual verification.

### Multi-Account Detection

**When:** Users create multiple accounts to bypass per-user limits.

**Approach:**
- Device fingerprinting
- IP analysis and clustering
- Phone number verification for score submissions
- Behavioral similarity detection

---

## Priority 2: Scale Improvements

### Debounced SSE Broadcasts

**When:** Many score updates cause too many broadcasts.

**Approach:** Batch updates, max 10 broadcasts per second. Clients see slightly delayed but smoother updates.

### Database Connection Pooling

**When:** Connection limits become bottleneck.

**Approach:** PgBouncer for PostgreSQL, Redis connection pooling.

### Read Replicas

**When:** Leaderboard reads slow down primary database.

**Approach:** Route GET /leaderboard to PostgreSQL read replica.

### Remove Redis Dependency (Simplification)

**When:** Concurrent users stay below 1,000.

**Approach:**
- Use PostgreSQL for everything
- Rate limiting via application memory or PostgreSQL
- Remove Redis infrastructure entirely
- SSE broadcast via application-level fan-out

---

## Priority 3: Feature Enhancements

### Regional Leaderboards

**When:** Global audience with regional competition desired.

**Implementation:**
- Separate Redis sorted set per region
- User assigned to region at registration
- API supports `?region=` parameter

### Leaderboard Resets

**When:** Seasonal or event-based competitions.

**Implementation:**
- Archive current leaderboard to history table
- Reset scores (or create new leaderboard key)
- SSE broadcast reset event
- Configurable: daily, weekly, monthly, or manual

### Leaderboard Pagination

**When:** Need to show beyond top 10/100.

**Implementation:**
- Add `?offset=` parameter
- `ZREVRANGE` with offset (or PostgreSQL OFFSET)
- Include user's position even if not in returned page

### Achievement System

**When:** Gamification desired beyond raw scores.

**Implementation:**
- Badges for milestones (first score, top 10, etc.)
- PostgreSQL table for achievements with JSONB metadata

### WebSocket Upgrade

**When:** Bidirectional communication needed (chat, collaborative features).

**Implementation:**
- Add Socket.io or ws library
- Keep SSE for leaderboard-only clients
- WebSocket for enhanced clients
- Same Redis pub/sub backend

---

## Priority 4: Operational Improvements

### Enhanced Monitoring

| Metric | Alert | Action |
|--------|-------|--------|
| p99 latency > 500ms | PagerDuty | Scale or investigate |
| Error rate > 1% | Slack | Investigate |
| Redis sync drift > 1 entry | Slack | Trigger sync |
| Action token rejection > 5% | Slack | Investigate abuse |

### Chaos Testing

**Scenarios:**
- Redis down: Verify fallback to PostgreSQL
- Action service unavailable: Verify graceful degradation
- Network partition: Verify eventual consistency
- High load: Verify rate limiting and queue behavior

### CloudWatch Log Analytics

**When:** Need deeper insights into patterns.

**Approach:**
- CloudWatch Log Insights for ad-hoc queries
- Export to S3 for long-term analysis
- Athena for complex queries over historical logs

---

## Implementation Roadmap (Suggested)

| Phase | Features | Trigger |
|-------|----------|---------|
| 1 | Core API + Action Token Security | Initial launch |
| 2 | Behavioral analysis | If abuse detected |
| 3 | Regional leaderboards | If global user base |
| 4 | Seasonal resets | If competition events |
| 5 | Full analytics | If business needs insights |

---

## NOT Planned

These features were considered and rejected:

| Feature | Reason |
|---------|--------|
| Blockchain score verification | Overkill for this use case |
| Client-side encryption | Server needs to read scores |
| Real-time score animations | Frontend concern, not backend |
| Social features (friends, challenges) | Different module scope |
| MongoDB for audit logs | CloudWatch + PostgreSQL sufficient |
| WebSocket (initial) | SSE is simpler for one-way updates |