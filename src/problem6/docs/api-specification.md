# API Specification

## Base URL

```
https://api.example.com/api/v1
```

## Versioning

- URL path versioning (`/api/v1/`, `/api/v2/`)
- Breaking changes require new version
- Deprecation: 6 months notice via `Deprecation` header
- Support: Old versions maintained 12 months after new version

---

## Authentication

All authenticated endpoints require:

```
Authorization: Bearer <jwt_token>
```

See [Security](./security.md) for JWT requirements.

---

## Common Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes (authenticated endpoints) | Bearer JWT token |
| Content-Type | Yes (PATCH/POST/PUT) | application/json |

### Response Headers

All responses include rate limit headers (see [Security](./security.md#rate-limiting)).

---

## REST Design Principles

This API follows RESTful conventions:

| Principle | Application |
|-----------|-------------|
| Resources as nouns | `/scores`, `/leaderboard` |
| HTTP verbs for actions | GET (read), PATCH (partial update) |
| Plural resource names | `/scores` not `/score` |
| Stateless requests | All context in request headers/body |

---

## Endpoints

### Internal API (For Action Service Only)

#### Generate Action Token

Called by the action service (game server, quiz engine, etc.) when a user completes an action.

**Request**

```
POST /internal/actions/complete
```

| Header | Required | Value |
|--------|----------|-------|
| X-Internal-API-Key | Yes | Shared secret between services |
| Content-Type | Yes | application/json |

**Request Body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| action_id | string | Yes | Unique identifier for this action instance |
| user_id | string | Yes | User who completed the action |
| max_score | integer | Yes | Maximum score allowed (1-10000) |
| metadata | object | No | Arbitrary data to store in audit log |

```json
{
  "action_id": "game_level_42_xyz789",
  "user_id": "usr_abc123",
  "max_score": 100,
  "metadata": {
    "game_id": "puzzle_master",
    "level": 42,
    "completion_time_ms": 45230
  }
}
```

**Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "action_token": "Z2FtZV9sZXZlbF80Ml94eXo3ODk6dXNyX2FiYzEyMzoxMDA6MTczNTM5ODQwMDpobWFjX3NpZw==",
    "expires_at": "2025-12-28T12:05:00Z"
  }
}
```

**Error Responses**

| HTTP | Code | When |
|------|------|------|
| 401 | `UNAUTHORIZED` | Invalid or missing X-Internal-API-Key |
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 409 | `ACTION_ALREADY_COMPLETED` | action_id already used |

**Security:**
- This endpoint is NOT exposed publicly
- Secured via shared API key (rotated quarterly)
- Should be network-isolated (internal VPC only)
- Rate limit: 1000 requests per minute per service

---

### Public API

### 1. Update Score

Updates the authenticated user's score after verifying a completed action.

**Request**

```
PATCH /api/v1/scores
```

| Header | Required | Value |
|--------|----------|-------|
| Authorization | Yes | Bearer token |
| Content-Type | Yes | application/json |

**Request Body**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| action_token | string | Yes | Server-issued token from action completion |
| score_delta | integer | Yes | 1 ≤ value ≤ max_score from token |

**Note on score_delta:** Users may submit any value between 1 and max_score. This allows for:
- Variable rewards (e.g., performance-based scoring)
- Partial credit scenarios
- Client-side reward selection (within allowed range)

```json
{
  "action_token": "Z2FtZV8xMjM0NTp1c3JfYWJjMTIzOjEwMDoxNzM1Mzk4NDAwOmhtYWNfc2ln",
  "score_delta": 100
}
```

**Action Token Validation:**
1. Token must be valid (not expired, correct signature)
2. Token user_id must match authenticated user
3. score_delta must not exceed token's max_score
4. Token must not have been used before (replay prevention)

**Success Response (200 OK)**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always `true` |
| data.user_id | string | User identifier |
| data.new_total_score | integer | Updated total score |
| data.score_added | integer | Delta applied |
| data.current_rank | integer | 1-indexed rank |
| data.updated_at | ISO 8601 | Timestamp |

```json
{
  "success": true,
  "data": {
    "user_id": "usr_abc123",
    "new_total_score": 1500,
    "score_added": 100,
    "current_rank": 5,
    "updated_at": "2025-12-28T12:00:00Z"
  }
}
```

**Rate Limit:** 10 requests per minute per user (action token prevents abuse, rate limit is secondary protection)

---

### 2. Get Leaderboard

Retrieves the top scores. Public endpoint (no auth required).

**Request**

```
GET /api/v1/leaderboard?limit=10
```

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| limit | integer | 10 | 1-100 |

**Success Response (200 OK)**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always `true` |
| data.leaderboard | array | Ranked user list |
| data.leaderboard[].rank | integer | 1-indexed position |
| data.leaderboard[].user_id | string | User identifier |
| data.leaderboard[].username | string | Display name |
| data.leaderboard[].score | integer | Total score |
| data.total_players | integer | Total users with scores |
| data.updated_at | ISO 8601 | Last leaderboard change |

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user_id": "usr_xyz789",
        "username": "TopPlayer",
        "score": 5000
      }
    ],
    "total_players": 1500,
    "updated_at": "2025-12-28T12:00:00Z"
  }
}
```

**Tie-Breaking:** Users with equal scores share the same rank. Order among tied users is by earliest achievement.

**Rate Limit:** 60 requests per minute per IP

---

### 3. Get My Score

Retrieves the authenticated user's rank and score.

**Request**

```
GET /api/v1/scores/me
```

| Header | Required |
|--------|----------|
| Authorization | Yes |

**Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "user_id": "usr_abc123",
    "username": "CurrentUser",
    "score": 1500,
    "rank": 42,
    "percentile": 97.2
  }
}
```

**Rate Limit:** 30 requests per minute per user

---

### 4. Server-Sent Events - Live Leaderboard

Real-time leaderboard updates via SSE.

**Endpoint**

```
GET /api/v1/leaderboard/stream
```

| Header | Required | Value |
|--------|----------|-------|
| Authorization | Optional | Bearer token (for personalized events) |
| Accept | Yes | text/event-stream |

**Connection**

```javascript
const eventSource = new EventSource('/api/v1/leaderboard/stream', {
  headers: { 'Authorization': 'Bearer ' + token }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Leaderboard update:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // EventSource auto-reconnects
};
```

**Server Events**

| Event | Payload | Trigger |
|-------|---------|---------| 
| `leaderboard` | Leaderboard array | Any score change in top 10 |
| `ping` | Empty | Keep-alive every 30s |

**`leaderboard` Event Format**

```
event: leaderboard
data: {"leaderboard":[{"rank":1,"user_id":"usr_xyz","username":"Top","score":5000}],"changed_positions":[1,2],"timestamp":"2025-12-28T12:00:00Z"}
```

**Connection Limits:**
- 5 concurrent connections per user (if authenticated)
- 10 concurrent connections per IP (if anonymous)

**Limit Enforcement:**
- Connections tracked in Redis: `sse_conn:<user_id>` or `sse_conn:<ip>`
- On connect: INCR counter, set TTL to connection timeout
- On disconnect: DECR counter
- If counter > limit: Return 429 "Too Many Connections", reject new connection
- Periodic cleanup: Remove stale connection counters

**Reconnection:** Browser's EventSource handles reconnection automatically with exponential backoff.

**Why SSE over WebSocket:**

| Factor | SSE Advantage |
|--------|---------------|
| Leaderboard direction | Server→client only (SSE is designed for this) |
| Reconnection | Automatic via EventSource API |
| Simplicity | Standard HTTP, no upgrade protocol |
| Proxy support | Works through HTTP proxies without special config |
| Browser support | Native, no library needed |

---

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

---

## Error Codes

| HTTP | Code | When | Client Action |
|------|------|------|---------------|
| 400 | `VALIDATION_ERROR` | Invalid request body | Fix request |
| 400 | `INVALID_ACTION_TOKEN` | Token malformed, expired, or wrong user | Get new token from action |
| 400 | `TOKEN_ALREADY_USED` | Action token replay attempt | Complete new action |
| 400 | `SCORE_EXCEEDS_MAX` | score_delta > token's max_score | Use valid score_delta |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT | Re-authenticate |
| 401 | `TOKEN_EXPIRED` | JWT expired | Refresh token |
| 401 | `SESSION_REVOKED` | Session invalidated | Re-login |
| 404 | `USER_NOT_FOUND` | User doesn't exist | Check ID |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| 500 | `INTERNAL_ERROR` | Server error | Contact support |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance | Retry later |

---

## Action Token Behavior

| Token State | Response |
|-------------|----------|
| Valid, unused | Process score update, mark token used |
| Valid, already used | Return cached response (idempotent) |
| Expired | 400 `INVALID_ACTION_TOKEN` |
| Wrong user | 400 `INVALID_ACTION_TOKEN` |
| Invalid signature | 400 `INVALID_ACTION_TOKEN` |

Token validity: Configurable, default 5 minutes after action completion.

---

## Client Implementation Notes

### Handling Rate Limits

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  await sleep(retryAfter * 1000);
  // Retry request
}
```

### SSE Connection

```javascript
const eventSource = new EventSource('/api/v1/leaderboard/stream');

eventSource.addEventListener('leaderboard', (e) => {
  const data = JSON.parse(e.data);
  updateLeaderboardUI(data.leaderboard);
});

// Auto-reconnect is handled by browser
eventSource.onerror = () => {
  console.log('Connection lost, reconnecting...');
};
```

---

## Testing Endpoints

For backend team testing:

| Scenario | Test |
|----------|------|
| Auth bypass | Send request without Authorization header |
| Rate limit | Send 11+ score updates in 1 minute |
| Invalid token | Send expired or tampered action_token |
| Token replay | Send same action_token twice |
| Invalid input | Send score_delta = 10000 |
| Concurrent update | Send 2 updates for same user simultaneously |
| SSE reconnect | Kill connection and verify auto-reconnect |