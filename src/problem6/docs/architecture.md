# Architecture Specification

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| API Server | Node.js / Express | Event-driven, good for real-time SSE handling |
| SQL Database | PostgreSQL 15+ | ACID transactions for score integrity, relational data |
| Cache / Leaderboard | Redis 7+ | O(log n) sorted sets, rate limiting, session cache |
| Real-time | Server-Sent Events (SSE) | Unidirectional server→client, simpler than WebSocket |
| Authentication | JWT | Stateless token verification |
| Logging | CloudWatch | ECS-native, no additional infrastructure |

---

## Data Responsibilities

| Store | Owns | Why |
|-------|------|-----|
| **PostgreSQL** | Users, Scores, Sessions, Audit Events | ACID transactions, single source of truth |
| **Redis** | Leaderboard Cache, Rate Limits, Session Cache | Speed-critical operations |
| **CloudWatch** | Application Logs, Metrics | ECS-native, operational visibility |

### Why NOT MongoDB?

| Consideration | Decision |
|---------------|----------|
| Audit logs for score changes | PostgreSQL `score_events` table is sufficient |
| Flexible metadata | PostgreSQL JSONB handles this |
| Operational complexity | One fewer database to maintain |
| CloudWatch integration | ECS logs automatically ship to CloudWatch |

---

## Action Verification (Critical)

### Server-Side Verification

The server **CAN and MUST** verify that an action was completed before accepting a score update. This is the primary defense against cheating.

**Flow:**
1. Game/Action service registers action completion with backend
2. Backend generates time-limited action token
3. Client includes action token in score update request
4. Backend validates token before processing score

**Action Token Requirements:**

| Field | Purpose |
|-------|---------|
| `action_id` | Unique identifier for the completed action |
| `user_id` | Who completed the action |
| `max_score` | Maximum score allowed for this action |
| `expires_at` | Token validity window (e.g., 5 minutes) |
| `signature` | HMAC to prevent tampering |

**Token Format:**
```
base64(action_id:user_id:max_score:expires_at):hmac_signature
```

**Verification Logic:**
1. Decode and parse token
2. Verify HMAC signature
3. Check expiration
4. Verify user_id matches authenticated user
5. Verify score_delta ≤ max_score
6. Mark token as consumed (prevent replay)

---

## Real-Time Updates: SSE vs WebSocket

### Decision: Server-Sent Events (SSE)

| Factor | SSE | WebSocket | Our Choice |
|--------|-----|-----------|------------|
| Direction | Server → Client | Bidirectional | SSE ✅ (we only need server→client) |
| Complexity | Simple HTTP | Protocol upgrade, ping/pong | SSE ✅ |
| Browser support | Native EventSource | Needs library | SSE ✅ |
| Reconnection | Auto-reconnect built-in | Manual implementation | SSE ✅ |
| Proxy/CDN compatibility | Standard HTTP | Often problematic | SSE ✅ |
| Scalability | Same as HTTP | Persistent connections | Tie |

**Why NOT WebSocket:**
- Leaderboard updates are **one-way** (server broadcasts to clients)
- No client-to-server messaging needed over the connection
- SSE has native auto-reconnect with `EventSource`
- Simpler infrastructure (no WebSocket upgrade handling)

**When to reconsider WebSocket:**
- If bidirectional communication needed (chat, collaborative features)
- If message frequency exceeds SSE efficiency threshold (>100/sec per client)

---

## Redis: Justified but Optional at Scale

### When Redis Makes Sense

| Concurrent Users | Redis Needed? | Reasoning |
|------------------|---------------|-----------|
| < 1,000 | ❌ No | PostgreSQL handles this trivially |
| 1,000 - 10,000 | ⚠️ Maybe | Depends on query frequency |
| > 10,000 | ✅ Yes | Read latency benefits become significant |

**This is admittedly premature optimization if concurrent users are small.** For < 1,000 users:
- PostgreSQL `ORDER BY score DESC LIMIT 10` with index is sub-millisecond
- Rate limiting can use application memory or PostgreSQL
- Session cache adds marginal value

### Why We Include Redis Anyway

1. **Rate limiting** - Redis sliding window is proven pattern
2. **Leaderboard cache** - O(log n) sorted set operations
3. **SSE broadcast coordination** - Pub/sub for multi-server deployment
4. **Horizontal scaling ready** - No refactoring needed when scale increases

### Redis Sync Strategy (Improved)

**Problem:** Hourly sync allows up to 59 minutes of incorrect data.

**Solution:** More aggressive sync with configurable interval.

| Sync Type | Trigger | Latency |
|-----------|---------|---------|
| Write-through | Every score update | Real-time |
| Periodic verification | Every 5 minutes (configurable) | 5 min max |
| Full rebuild | Daily at low-traffic hour | - |
| Manual trigger | Admin endpoint | Immediate |

**Drift Detection:**
- Compare top 100 entries between Redis and PostgreSQL
- Alert if >1 entry differs
- Auto-trigger full sync if drift detected

---

## Layer Architecture

```
Presentation → Middleware → Service → Repository → Data
```

| Layer | Responsibility | NOT Responsible For |
|-------|----------------|---------------------|
| **Presentation** | HTTP/SSE parsing, response formatting | Business logic |
| **Middleware** | Auth, action verification, rate limiting, validation | Data access |
| **Service** | Business rules, orchestration | HTTP concerns |
| **Repository** | Data access, query optimization | Business decisions |
| **Data** | Persistence, indexing | Application logic |

---

## Architecture Decision Records

### ADR-001: Modular Monolith (Not Microservices)

**Context:** Unknown scale, small team assumed, simple domain.

**Decision:** Start as modular monolith with clear module boundaries.

**Consequences:**
- ✅ Faster development, simpler deployment
- ✅ Easy refactoring, single debug context
- ❌ Limited independent scaling
- ❌ Single point of failure

**Revisit When:**
- Team exceeds 8-10 engineers
- Components need independent scaling (10x difference)
- Different tech requirements per component

### ADR-002: Single Database (PostgreSQL Only)

**Context:** Need ACID for scores, audit logging, and user data.

**Decision:** PostgreSQL for all persistent data. CloudWatch for operational logs.

**Consequences:**
- ✅ Single database to maintain
- ✅ Transactional consistency across all entities
- ✅ JSONB for flexible metadata where needed
- ✅ CloudWatch integration free with ECS
- ❌ PostgreSQL handles write-heavy audit (acceptable for our scale)

### ADR-003: Redis as Optional Cache Layer

**Context:** Need fast leaderboard queries at scale, but may be overkill initially.

**Decision:** PostgreSQL is source of truth. Redis is optional cache.

**Consequences:**
- Write-through: Update PostgreSQL first, then Redis
- On Redis failure: Fallback to PostgreSQL (slower but correct)
- 5-minute sync job to detect/fix drift
- **Can be disabled entirely for small deployments**

### ADR-004: Server-Sent Events (Not WebSocket)

**Context:** Need real-time leaderboard updates, server→client only.

**Decision:** SSE for simplicity and native browser support.

**Consequences:**
- ✅ Simpler than WebSocket
- ✅ Auto-reconnect built into EventSource
- ✅ Standard HTTP, no proxy issues
- ❌ No client→server messaging (not needed)

### ADR-005: EC2/ECS (Not Lambda) for Initial Deployment

**Context:** SSE requires persistent connections.

**Decision:** Containerized deployment on ECS Fargate.

**Revisit When:**
- If traffic is very bursty (serverless better for cost)
- If SSE replaced with polling

---

## Edge Cases (Implementation Requirements)

### EDGE-001: Concurrent Score Updates

**Scenario:** Two requests update same user's score simultaneously.

**Requirement:** Use row-level locking (`SELECT ... FOR UPDATE`) to serialize updates.

**Acceptance:** Second request sees result of first request, no lost updates.

### EDGE-002: Score Ties

**Scenario:** Users A and B both have score 1000.

**Requirement:** Rank by "first to reach" - whoever reached 1000 points first ranks higher.

**Implementation:**
- PostgreSQL: `score_first_reached_at` timestamp, updated ONLY when score increases
- Redis: Composite score encoding both score and timestamp
- Query: `ORDER BY total_score DESC, score_first_reached_at ASC`

See [Data Models](./data-models.md#scores-table) for detailed implementation.

### EDGE-003: Redis-PostgreSQL Drift

**Scenario:** Redis and PostgreSQL leaderboard data diverge.

**Requirements:**
1. Write-through caching (PostgreSQL first, then Redis)
2. On Redis failure: Queue for retry, don't fail request
3. 5-minute sync job compares and corrects drift (configurable, down from hourly)
4. Alert if drift exceeds threshold
5. Admin endpoint for manual full sync

### EDGE-004: User Deletion

**Scenario:** User deletes account while on leaderboard.

**Requirements:**
1. CASCADE delete from PostgreSQL (scores, sessions)
2. SET NULL on score_events.user_id (retain anonymized audit logs)
3. Remove from Redis leaderboard: `ZREM leaderboard:global <user_id>`
4. Publish SSE update if user was in top 10
5. Clear any cached session data

**Implementation:**
```javascript
async function deleteUser(userId) {
  // 1. Check if user in top 10 before deletion
  const wasInTop10 = await isUserInTop10(userId);
  
  // 2. Delete from PostgreSQL (CASCADE handles scores, sessions)
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
  
  // 3. Remove from Redis leaderboard
  await redis.zrem('leaderboard:global', userId);
  
  // 4. Broadcast if was in top 10
  if (wasInTop10) {
    await publishLeaderboardUpdate();
  }
}
```

### EDGE-005: Integer Overflow

**Scenario:** Score exceeds safe integer range.

**Requirement:** 
- PostgreSQL: BIGINT (max 9.2 × 10^18)
- Application: Check against `Number.MAX_SAFE_INTEGER` before update
- If near overflow: Alert, cap at maximum

### EDGE-006: Action Token Replay

**Scenario:** Client tries to use same action token multiple times.

**Requirements:**
1. Store consumed tokens in database with TTL
2. Reject duplicate action_id within expiry window
3. Return cached response for idempotent handling

---

## Scalability Strategy

### Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| API Servers | Stateless, behind load balancer |
| SSE | Redis pub/sub for cross-server broadcast |
| PostgreSQL | Read replicas for leaderboard queries |

### Performance Targets

| Operation | Target | Method |
|-----------|--------|--------|
| Score update | < 100ms p99 | PostgreSQL transaction + Redis ZINCRBY |
| Leaderboard fetch | < 50ms p99 | Redis ZREVRANGE (or PostgreSQL if no Redis) |
| SSE broadcast | < 200ms delivery | Redis pub/sub |

---

## Monitoring Requirements

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Score update latency p99 | > 500ms | Scale API servers |
| Redis-PostgreSQL drift | > 1 entry | Trigger sync job |
| Rate limit 429 responses | > 1000/min | Review limits or investigate abuse |
| SSE connections | > 80% capacity | Scale or optimize |
| Action token rejection rate | > 5% | Investigate potential abuse or client bugs |