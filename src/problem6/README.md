# Scoreboard Module - Specification

## Purpose

This document specifies the backend API module for a real-time scoreboard system. It is intended for a backend engineering team to implement.

**What this document is:** A specification defining behavior, contracts, and requirements.

**What this document is NOT:** Implementation code or tutorials.

---

## Requirements Summary

| Requirement | Solution |
|-------------|----------|
| Show top 10 user scores | Redis sorted set + GET /leaderboard |
| Live scoreboard updates | Server-Sent Events (SSE) with Redis pub/sub |
| User actions increase score | PATCH /scores with action token |
| Prevent unauthorized score increases | **Action token verification** + JWT + Rate limiting |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [Architecture](./docs/architecture.md) | Tech stack decisions, ADRs, SSE vs WebSocket, Redis justification |
| [API Specification](./docs/api-specification.md) | REST endpoints (RESTful design), SSE, error codes |
| [Data Models](./docs/data-models.md) | PostgreSQL schemas, Redis structures |
| [Security](./docs/security.md) | Action token verification, authentication, rate limiting |
| [Diagrams](./docs/diagrams.md) | Flow diagrams (Mermaid) |
| [Deployment](./docs/deployment.md) | Environment, infrastructure, CI/CD, CloudWatch |
| [Improvements](./docs/improvements.md) | Future enhancements (out of scope) |

---

## Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| API Server | Node.js / Express | Event-driven, SSE support |
| SQL Database | PostgreSQL | ACID transactions for score integrity |
| Cache | Redis | O(log n) leaderboard, rate limiting, pub/sub |
| Real-time | Server-Sent Events (SSE) | Simpler than WebSocket for server→client only |
| Auth | JWT + Action Tokens | Identity + action verification |
| Logging | CloudWatch | ECS-native, zero additional infrastructure |

**Why NOT MongoDB?** See [Architecture](./docs/architecture.md#why-not-mongodb). CloudWatch handles logging; PostgreSQL handles audit trail.

**Why SSE over WebSocket?** See [Architecture](./docs/architecture.md#real-time-updates-sse-vs-websocket). Leaderboard updates are one-way (server→client).

**Is Redis necessary?** See [Architecture](./docs/architecture.md#redis-justified-but-optional-at-scale). For < 1,000 concurrent users, PostgreSQL alone is sufficient. Redis is included for horizontal scaling readiness.

---

## Security Model

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 0 | **Action Token Verification** | **Primary defense** - proves action was completed |
| 1 | JWT Authentication | Identity verification |
| 2 | Session Management | Token revocation support |
| 3 | Rate Limiting | Abuse throttling (secondary defense) |

**Key Insight:** Without server-side action verification, any security is just damage control. Action tokens ensure only completed actions can generate scores.

See [Security Specification](./docs/security.md) for full details.

---

## API Overview

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| PATCH | /scores | Yes + Action Token | Update user score |
| GET | /leaderboard | No | Get top 10 |
| GET | /scores/me | Yes | Get user's rank |
| GET | /leaderboard/stream | Optional | Live updates (SSE) |

See [API Specification](./docs/api-specification.md) for full details.

---

## Score Update Flow (Summary)

```
Action Service → Action Token → Client
                                  ↓
Client → Auth → Token Verify → Rate Limit → PostgreSQL → Redis → Response
                                                       ↓
                                                 SSE broadcast
```

See [Diagrams](./docs/diagrams.md) for detailed flows.

---

## Edge Cases (Must Handle)

| Case | Requirement |
|------|-------------|
| Fake score submission | Action token verification (primary defense) |
| Action token replay | Consumed token tracking in DB |
| Concurrent updates | Row-level locking (SELECT FOR UPDATE) |
| Score ties | Rank by earliest achievement |
| Redis failure | Fallback to PostgreSQL, queue retry |
| Token expired mid-use | 400 error, client must get new token |
| User deletion | CASCADE delete + Redis cleanup |

See [Architecture](./docs/architecture.md#edge-cases-implementation-requirements) for details.

---

## Implementation Checklist

### Phase 1: Core

- [ ] PostgreSQL schema (users, scores, sessions, score_events, consumed_tokens)
- [ ] Redis setup (leaderboard, rate limit, session cache, token cache)
- [ ] PATCH /scores with action token validation
- [ ] GET /leaderboard
- [ ] GET /scores/me
- [ ] GET /leaderboard/stream (SSE)
- [ ] Health check endpoint

### Phase 2: Security

- [ ] Action token generation (internal endpoint for action service)
- [ ] Action token validation middleware
- [ ] Consumed token tracking
- [ ] JWT auth middleware
- [ ] Session validation
- [ ] Rate limiting middleware
- [ ] Input validation
- [ ] Security headers

### Phase 3: Observability

- [ ] Structured logging (JSON, to CloudWatch via ECS)
- [ ] Prometheus metrics
- [ ] Health check with dependency checks
- [ ] Error tracking (Sentry or similar)

### Phase 4: Deployment

- [ ] Dockerfile
- [ ] Docker Compose (development)
- [ ] CI/CD pipeline
- [ ] Environment configuration

---

## Open Questions (Before Implementation)

| Question | Impact | Default if not answered |
|----------|--------|------------------------|
| Action service integration method? | Token generation flow | Internal REST endpoint |
| Expected DAU / peak concurrent users? | Infrastructure sizing | Design for 10K, but Redis optional < 1K |
| Tie-breaking preference? | Ranking display | First to achieve ranks higher |
| Leaderboard reset needed? | Feature scope | No resets in v1 |
| Action token TTL? | Security/UX tradeoff | 5 minutes |

---

## Getting Started (For Backend Team)

1. Read [Architecture](./docs/architecture.md) for tech decisions and tradeoffs
2. Read [Security](./docs/security.md) for action token verification (critical)
3. Read [Data Models](./docs/data-models.md) for schemas
4. Read [API Specification](./docs/api-specification.md) for contracts
5. Implement in phases per checklist above
6. Use [Deployment](./docs/deployment.md) for infrastructure setup

---

## Out of Scope

These are NOT part of this specification:

- Game/action implementation (but action service must call internal API to generate tokens)
- Game/action implementation (but must integrate with action token flow)
- Frontend implementation
- Admin dashboard
- Analytics/reporting

See [Improvements](./docs/improvements.md) for future enhancements.