# Data Model Specification

## Overview

This specification defines the data structures for the scoreboard module. The architecture uses:

- **PostgreSQL**: All persistent data (users, scores, sessions, audit events)
- **Redis**: Cache layer (leaderboard, rate limits, session cache, consumed tokens)
- **CloudWatch**: Application logs (via ECS integration)

---

## PostgreSQL Schema

### Users Table

**Purpose:** Store user identity and authentication data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### Scores Table

**Purpose:** Store current score for each user. One row per user.

```sql
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_score BIGINT NOT NULL DEFAULT 0,
    score_first_reached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- For tie-breaking: when user FIRST reached current score
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT scores_user_unique UNIQUE (user_id),
    CONSTRAINT scores_non_negative CHECK (total_score >= 0)
);

CREATE INDEX idx_scores_total_score ON scores(total_score DESC);
CREATE INDEX idx_scores_user_id ON scores(user_id);
-- Composite index for tie-breaking queries (first to reach wins)
CREATE INDEX idx_scores_leaderboard ON scores(total_score DESC, score_first_reached_at ASC);
```

**Tie-Breaking Logic:**
- `score_first_reached_at` is updated ONLY when `total_score` increases
- If User A reaches 1000 points at 10:00 and User B reaches 1000 at 10:05, User A ranks higher
- Update logic:
```sql
UPDATE scores 
SET total_score = total_score + $delta,
    score_first_reached_at = CASE 
        WHEN total_score + $delta > total_score THEN NOW() 
        ELSE score_first_reached_at 
    END,
    updated_at = NOW()
WHERE user_id = $user_id;
```

### Sessions Table

**Purpose:** Store active user sessions for token invalidation support.

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,  -- SHA256 of JWT
    ip_address INET,
    user_agent VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE  -- NULL if active
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### Score Events Table (Audit Log)

**Purpose:** Audit log of all score changes. Replaces MongoDB collection.

```sql
CREATE TABLE score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action_token_hash VARCHAR(64) NOT NULL,  -- SHA256 of action token
    action_id VARCHAR(100) NOT NULL,
    score_delta INTEGER NOT NULL,
    score_before BIGINT NOT NULL,
    score_after BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}',  -- Flexible: game_id, level, duration_ms, etc.
    client_info JSONB DEFAULT '{}',  -- ip_address, user_agent, device_type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_score_events_user_created ON score_events(user_id, created_at DESC);
CREATE INDEX idx_score_events_action_token ON score_events(action_token_hash);
CREATE INDEX idx_score_events_created ON score_events(created_at);
```

**Retention:** Use pg_partman or scheduled job to delete events older than 90 days.

```sql
-- Example cleanup (run daily)
DELETE FROM score_events WHERE created_at < NOW() - INTERVAL '90 days';
```

### Consumed Action Tokens Table

**Purpose:** Prevent action token replay attacks.

```sql
CREATE TABLE consumed_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,  -- SHA256 of action token
    user_id UUID NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL  -- Auto-cleanup after this
);

CREATE INDEX idx_consumed_tokens_expires ON consumed_tokens(expires_at);
```

**Cleanup:** Delete expired tokens periodically.

```sql
DELETE FROM consumed_tokens WHERE expires_at < NOW();
```

---

## Redis Data Structures

### Leaderboard (Sorted Set)

**Key:** `leaderboard:global`

**Operations:**
| Operation | Command | Complexity |
|-----------|---------|------------|
| Set score | `ZADD leaderboard:global <composite_score> <user_id>` | O(log n) |
| Get top 10 | `ZREVRANGE leaderboard:global 0 9 WITHSCORES` | O(log n + 10) |
| Get user rank | `ZREVRANK leaderboard:global <user_id>` | O(log n) |
| Get total users | `ZCARD leaderboard:global` | O(1) |
| Remove user | `ZREM leaderboard:global <user_id>` | O(log n) |

**Tie-Breaking in Redis:**
Redis sorted sets break ties by lexicographic order of member (user_id). To match PostgreSQL's "first to reach" behavior, we use a composite score:

```javascript
// Composite score: higher score wins, earlier timestamp wins for ties
const MAX_TIMESTAMP = 9999999999999; // Far future (milliseconds)
const compositeScore = score * 1e13 + (MAX_TIMESTAMP - scoreFirstReachedAt.getTime());
await redis.zadd('leaderboard:global', compositeScore, userId);

// To extract actual score for display:
const actualScore = Math.floor(compositeScore / 1e13);
```

**PostgreSQL Fallback Query (must match Redis order):**
```sql
SELECT u.id, u.username, s.total_score
FROM scores s 
JOIN users u ON s.user_id = u.id
ORDER BY s.total_score DESC, s.score_first_reached_at ASC
LIMIT 10;
```

**Note:** PostgreSQL is source of truth. Redis is cache.

### Rate Limiting (Sorted Set)

**Key:** `rate_limit:score:<user_id>`

**Strategy:** Sliding window using timestamps as scores.

```
ZADD rate_limit:score:usr_abc123 <timestamp> <request_id>
ZREMRANGEBYSCORE rate_limit:score:usr_abc123 0 <timestamp - window>
ZCARD rate_limit:score:usr_abc123
```

**TTL:** Auto-expire after window duration.

### Session Cache (String)

**Key:** `session:<token_hash>`

**Value:** JSON with user_id, expiry, revoked status

**TTL:** Match JWT expiry

```json
{
  "user_id": "usr_abc123",
  "expires_at": "2025-12-29T12:00:00Z",
  "revoked": false
}
```

### Action Token Cache (String)

**Key:** `action_token:<token_hash>`

**Value:** Response JSON for idempotency (or `"consumed"` if response not cached yet)

**TTL:** Token expiry time + 1 hour (for idempotent response)

**Token Consumption Flow:**
```
1. Client sends PATCH /scores with action_token
2. Check Redis: GET action_token:<hash>
   - If found with response → return cached response (idempotent)
   - If found with "consumed" → return cached response
   - If not found → continue
3. Check PostgreSQL: SELECT FROM consumed_tokens WHERE token_hash = $hash
   - If found → token already used, return error or cached response
   - If not found → continue
4. BEGIN PostgreSQL transaction:
   - INSERT INTO consumed_tokens (token_hash, user_id, expires_at)
   - UPDATE scores
   - INSERT INTO score_events
   - COMMIT
5. SET Redis: action_token:<hash> = response_json (with TTL)
6. Return success response

**Source of Truth:** PostgreSQL consumed_tokens table
**Cache:** Redis action_token:* (for fast lookup and idempotency)
```

### SSE Pub/Sub

**Channel:** `leaderboard:updates`

**Message:** JSON with leaderboard array and timestamp

```json
{
  "leaderboard": [...],
  "changed_positions": [1, 2],
  "timestamp": "2025-12-28T12:00:00Z"
}
```

---

## CloudWatch Logging

### Log Format

Application logs automatically ship to CloudWatch via ECS.

**Structured Log Format (JSON):**

```json
{
  "timestamp": "2025-12-28T12:00:00.000Z",
  "level": "info",
  "service": "scoreboard-api",
  "requestId": "uuid",
  "userId": "usr_xxx",
  "action": "score_update",
  "message": "Score updated successfully",
  "data": {
    "scoreDelta": 100,
    "newScore": 1500,
    "rank": 5
  }
}
```

**Log Groups:**
- `/ecs/scoreboard-api` - Application logs
- `/ecs/scoreboard-api/access` - HTTP access logs (optional)

**Why CloudWatch instead of MongoDB:**
- Zero additional infrastructure (ECS → CloudWatch is automatic)
- Built-in retention policies
- Log Insights for querying
- Alarms and metrics integration
- Cost-effective for moderate log volume

---

## Data Validation Rules

| Field | Type | Constraints |
|-------|------|-------------|
| `username` | String | 3-50 chars, `^[a-zA-Z0-9_]+$` |
| `email` | String | Valid email format, max 255 chars |
| `score_delta` | Integer | 1 ≤ value ≤ max_score from action token |
| `total_score` | BigInt | ≥ 0 |
| `action_token` | String | Valid base64, HMAC verified |

---

## Entity Relationships

```
PostgreSQL:
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    Users    │──1:1──│   Scores    │       │  Sessions   │
│             │       │             │       │             │
│ id          │──┐    │ id          │       │ id          │
│ username    │  │    │ user_id     │       │ user_id ────│───┐
│ email       │  │    │ total_score │       │ token_hash  │   │
│ ...         │  │    │ updated_at  │       │ expires_at  │   │
└─────────────┘  │    └─────────────┘       └─────────────┘   │
                 │                                            │
                 └────────────────────────────────────────────┘
                 │
                 │    ┌─────────────────┐
                 └───►│  Score Events   │
                      │ (Audit Log)     │
                      │                 │
                      │ id              │
                      │ user_id         │
                      │ action_token    │
                      │ score_delta     │
                      │ metadata (JSON) │
                      │ created_at      │
                      └─────────────────┘

                      ┌─────────────────┐
                      │ Consumed Tokens │
                      │                 │
                      │ token_hash (PK) │
                      │ user_id         │
                      │ expires_at      │
                      └─────────────────┘

Redis (Cache Layer):
┌──────────────────┐
│ leaderboard:*    │──── Cached view of PostgreSQL scores
│ rate_limit:*     │──── Temporary rate limit counters
│ session:*        │──── Session cache
│ action_token:*   │──── Consumed token tracking + idempotency
└──────────────────┘

CloudWatch (Logs):
┌──────────────────┐
│ /ecs/scoreboard  │──── Application logs (auto from ECS)
└──────────────────┘
```

---

## Data Consistency Requirements

| Scenario | Requirement |
|----------|-------------|
| Score update | PostgreSQL is source of truth, Redis follows (write-through) |
| Redis failure | Queue update for retry, don't fail request, fallback to PostgreSQL |
| Session check | Check Redis first, fallback to PostgreSQL |
| Leaderboard read | Read from Redis, fallback to PostgreSQL if miss/unavailable |
| Action token check | Check Redis first (consumed tokens), then PostgreSQL |
| Audit logging | PostgreSQL transaction includes score_events insert |

---

## Retention Policies

| Data | Retention | Rationale |
|------|-----------|-----------|
| Users | Indefinite | Account data |
| Scores | Indefinite | Current state |
| Sessions | Until expiry + 24h | Security audit |
| Score Events | 90 days (configurable) | Audit trail, fraud detection |
| Consumed Tokens | Until token expiry + 1h | Replay prevention |
| Rate limit data | Sliding window | Automatically expires |
| CloudWatch logs | 30 days (configurable) | Cost management |