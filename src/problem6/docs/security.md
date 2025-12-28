# Security Specification

## Overview

This document specifies security requirements for the scoreboard module. The primary goal is **preventing unauthorized score manipulation**.

---

## Security Model Summary

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 0 | Action Token Verification | **Primary defense** - proves action was completed |
| 1 | JWT Authentication | Identity verification |
| 2 | Session Management | Token revocation support |
| 3 | Rate Limiting | Abuse throttling (secondary defense) |

---

## Layer 0: Action Token Verification (Critical)

This is the **primary defense** against cheating. Without action verification, all other security measures are just damage control.

### How It Works

1. **Action Service** (game server, quiz engine, etc.) registers action completion
2. **Backend** generates a signed, time-limited action token
3. **Client** receives action token upon completing action
4. **Client** includes action token when requesting score update
5. **Backend** validates token before processing score

### Action Token Structure

```
base64(payload):hmac_signature
```

**Payload (before encoding):**
```
action_id:user_id:max_score:expires_at
```

| Field | Description |
|-------|-------------|
| `action_id` | Unique identifier for this action instance |
| `user_id` | Who completed the action |
| `max_score` | Maximum score allowed for this action |
| `expires_at` | Unix timestamp when token expires |

**Example:**
```
Z2FtZV8xMjM0NTp1c3JfYWJjMTIzOjEwMDoxNzM1Mzk4NDAwOmFiY2RlZjEyMzQ1Ng==
```

### Validation Rules

| Check | Failure Response |
|-------|------------------|
| Decode payload | 400 `INVALID_ACTION_TOKEN` |
| Verify HMAC signature | 400 `INVALID_ACTION_TOKEN` |
| Check expiration | 400 `INVALID_ACTION_TOKEN` |
| Verify user_id matches JWT | 400 `INVALID_ACTION_TOKEN` |
| Check score_delta ≤ max_score | 400 `SCORE_EXCEEDS_MAX` |
| Check token not consumed | 400 `TOKEN_ALREADY_USED` |

### Token Consumption (Replay Prevention)

```sql
-- Before processing score update
INSERT INTO consumed_tokens (token_hash, user_id, expires_at)
VALUES (sha256($action_token), $user_id, $expires_at)
ON CONFLICT (token_hash) DO NOTHING
RETURNING token_hash;

-- If no row returned, token was already consumed
```

**Idempotency:** If token was already consumed, return the cached response from the original request.

### Action Token Generation (For Action Service)

```javascript
function generateActionToken(actionId, userId, maxScore, ttlSeconds = 300) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${actionId}:${userId}:${maxScore}:${expiresAt}`;
  const signature = hmacSha256(payload, ACTION_TOKEN_SECRET);
  return base64Encode(`${payload}:${signature}`);
}
```

### Security Properties

| Property | How Achieved |
|----------|--------------|
| Cannot forge | HMAC signature requires secret |
| Cannot modify | Any change invalidates signature |
| Cannot replay | Consumed tokens tracked |
| Time-limited | Expires after TTL (default 5 min) |
| User-bound | Token includes user_id, verified against JWT |
| Score-capped | Token includes max_score |

---

## Layer 1: Authentication (JWT)

### Requirements

| Requirement | Specification |
|-------------|---------------|
| Algorithm | HS256 or RS256 |
| Access token expiry | 24 hours |
| Refresh token expiry | 7 days |
| Token storage | HTTP-only cookie or Authorization header |
| Required claims | `sub` (user_id), `exp`, `iat`, `type` |

### Behavior

| Scenario | Response |
|----------|----------|
| Missing Authorization header | 401 `UNAUTHORIZED` |
| Malformed token | 401 `INVALID_TOKEN` |
| Expired token | 401 `TOKEN_EXPIRED` |
| Revoked session | 401 `SESSION_REVOKED` |
| Valid token | Proceed to next layer |

---

## Tiered Validation Strategy

Not all endpoints need the same level of validation. We use tiered validation to optimize performance while maintaining security.

| Endpoint | JWT | Session Check | Action Token | Rate Limit | Reasoning |
|----------|-----|---------------|--------------|------------|-----------|
| PATCH /scores | ✅ | ❌ Skip | ✅ | ✅ | Action token IS the proof of authorization |
| GET /scores/me | ✅ | ✅ | ❌ | ✅ | User-specific data needs session validation |
| GET /leaderboard | ❌ | ❌ | ❌ | ✅ (IP) | Public endpoint |
| GET /leaderboard/stream | Optional | Optional | ❌ | ✅ | Public with optional personalization |

**Why skip session check for PATCH /scores?**

The action token already proves:
1. User completed a specific action (verified by action service)
2. Token is bound to this user_id (embedded in token)
3. Token hasn't been used before (replay prevention)
4. Token hasn't expired (time-limited)

Session validation adds:
- Additional Redis/PostgreSQL lookup per request
- ~5-10ms latency
- Protection against revoked sessions

**Trade-off analysis:**
- Without session check: A user with a revoked session can still redeem valid action tokens
- With session check: Every score update is slower
- Decision: Skip session check. If user has a valid action token, they earned the score. Session revocation is for preventing future access, not retroactively invalidating earned rewards.

**When session check IS critical:**
- GET /scores/me - Returns user-specific data
- Any endpoint that returns or modifies user profile
- Admin endpoints

---

## Layer 2: Session Management

### Requirements

Sessions enable token revocation (e.g., logout, compromised account).

| Requirement | Specification |
|-------------|---------------|
| Session storage | PostgreSQL (primary) + Redis (cache) |
| Session creation | On login, store hash of JWT |
| Session validation | Check token hash not revoked |
| Session revocation | Mark `revoked_at`, clear Redis cache |

### Behavior

| Scenario | Response |
|----------|----------|
| Token hash not in sessions | 401 `SESSION_NOT_FOUND` |
| Session revoked | 401 `SESSION_REVOKED` |
| Session expired | 401 `SESSION_EXPIRED` |
| Redis unavailable | Fallback to PostgreSQL lookup |

### Endpoints Required

| Endpoint | Purpose |
|----------|---------|
| POST /auth/logout | Revoke current session |
| POST /auth/logout-all | Revoke all user sessions |

---

## Layer 3: Rate Limiting

Rate limiting is a **secondary defense**. With action token verification, rate limiting primarily protects against:
- DDoS attempts
- Client bugs causing request loops
- Resource exhaustion

### Requirements

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| PATCH /scores | 10 requests | 1 minute | User ID |
| GET /leaderboard | 60 requests | 1 minute | IP address |
| GET /scores/me | 30 requests | 1 minute | User ID |
| GET /leaderboard/stream | 5 connections | Per user | User ID |

**Note:** PATCH /scores limit is higher (10/min vs previous 2/min) because action tokens are the primary control. Rate limiting is backup.

### Behavior

| Scenario | Response |
|----------|----------|
| Under limit | Proceed, set rate limit headers |
| At limit | 429 `RATE_LIMIT_EXCEEDED` with `Retry-After` header |
| Redis unavailable | Fail open (allow request), log warning |

### Response Headers

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1735398400
Retry-After: 45  (only on 429)
```

---

## Input Validation

### Score Update Request

| Field | Type | Constraints | Error |
|-------|------|-------------|-------|
| action_token | string | required, valid format, HMAC verified | `INVALID_ACTION_TOKEN` |
| score_delta | integer | required, 1 ≤ value ≤ max_score from token | `INVALID_SCORE_DELTA` or `SCORE_EXCEEDS_MAX` |

### General Rules

| Rule | Specification |
|------|---------------|
| Unknown fields | Strip silently |
| Type coercion | Do not coerce (e.g., "100" → 100 is invalid) |
| Empty strings | Treat as missing |

---

## Security Headers

All responses MUST include:

| Header | Value |
|--------|-------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Content-Security-Policy | default-src 'self' |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| Referrer-Policy | strict-origin-when-cross-origin |

---

## Threat Model

| Threat | Mitigation | Effectiveness |
|--------|------------|---------------|
| Fake score submission | Action token verification | ✅ **High** |
| Unauthenticated access | JWT required | ✅ High |
| Session hijacking | Token hash validation | ✅ High |
| Score spam | Action tokens + rate limit | ✅ High |
| Action token replay | Consumed token tracking | ✅ High |
| SQL injection | Parameterized queries | ✅ High |
| XSS | Security headers, CSP | ✅ High |
| Token tampering | HMAC signature | ✅ High |

### Residual Risks

| Risk | Impact | Mitigation Path |
|------|--------|-----------------|
| Compromised action service | Unlimited valid tokens | Isolate action service, monitor anomalies |
| ACTION_TOKEN_SECRET leaked | Can forge tokens | Rotate secret, re-issue tokens |
| Multiple accounts per person | Circumvent per-user limits | Device fingerprinting, phone verification |

---

## What We Deliberately Did NOT Implement

### Behavioral Analysis

**Why not initially:** With action token verification, the attack surface is significantly reduced. Behavioral analysis is complex and can have false positives.

**When to add:** If abuse patterns emerge despite action tokens (e.g., compromised action service, automated action completion).

### Client-Side Attestation

**Why not:** Can always be bypassed with enough effort. Server-side action verification is more reliable.

**When to consider:** Mobile apps with platform attestation (SafetyNet, App Attest).

### Blockchain/Cryptographic Proofs

**Why not:** Massive complexity for marginal benefit in this use case.

**When to consider:** Never for a leaderboard. Consider for financial transactions or legal compliance.

---

## Security Checklist for Backend Team

### Must Implement

- [ ] Action token generation endpoint (for action service)
- [ ] Action token validation in score update
- [ ] Consumed token tracking (PostgreSQL + Redis)
- [ ] JWT validation middleware
- [ ] Session table and validation
- [ ] Rate limiting with Redis
- [ ] Input validation (reject invalid, don't sanitize)
- [ ] Parameterized queries (no string concatenation)
- [ ] Security headers middleware
- [ ] HTTPS enforcement

### Configuration Required

- [ ] JWT_SECRET (min 32 chars, from secrets manager)
- [ ] ACTION_TOKEN_SECRET (min 32 chars, from secrets manager, different from JWT)
- [ ] Rate limit values (from environment)
- [ ] Session expiry times
- [ ] CORS origins whitelist
- [ ] Action token TTL (default 300 seconds)

### Testing Required

- [ ] Action token validation (expired, wrong user, tampered, replay)
- [ ] Auth bypass attempts
- [ ] Rate limit enforcement
- [ ] Input validation edge cases
- [ ] Session revocation flow
- [ ] Token consumption idempotency