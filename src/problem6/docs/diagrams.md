# System Flow Diagrams

## Score Update Flow (with Action Token Verification)

```mermaid
sequenceDiagram
    participant AS as Action Service
    participant C as Client
    participant API as API Server
    participant Auth as Auth Layer
    participant Token as Token Validator
    participant Rate as Rate Limiter
    participant Svc as Score Service
    participant PG as PostgreSQL
    participant RD as Redis
    participant SSE as SSE Broadcaster

    Note over AS,C: User completes action in game/app
    AS->>API: Report action completion
    API->>AS: Action token (signed, time-limited)
    AS->>C: Action token + completion UI
    
    C->>API: PATCH /scores
    Note over C,API: Headers: Authorization<br/>Body: action_token, score_delta
    
    API->>Auth: Validate JWT + Session
    Auth->>RD: Check session not revoked
    
    alt Invalid Auth
        Auth-->>C: 401 Unauthorized
    else Valid Auth
        Auth->>Token: Validate action token
        
        alt Invalid Token
            Token-->>C: 400 Invalid/Expired/Tampered
        else Token Already Used
            Token->>RD: Check consumed_tokens
            RD-->>Token: Token exists
            Token-->>C: 200 Return cached response (idempotent)
        else Valid & Unused
            Token->>Rate: Check rate limit
            
            alt Limit Exceeded
                Rate-->>C: 429 Too Many Requests
            else Within Limit
                Rate->>Svc: Process update
                
                Svc->>PG: BEGIN TRANSACTION
                Svc->>PG: INSERT consumed_tokens
                Svc->>PG: SELECT ... FOR UPDATE (scores)
                Svc->>PG: UPDATE scores
                Svc->>PG: INSERT score_events (audit)
                Svc->>PG: COMMIT
                
                par Update Leaderboard Cache
                    Svc->>RD: ZINCRBY leaderboard
                end
                
                Svc->>RD: Cache response (for idempotency)
                Svc->>SSE: Publish update
                Svc-->>C: 200 OK with new score
            end
        end
    end
```

---

## Action Token Flow (Detail)

```mermaid
sequenceDiagram
    participant Game as Game/Action Service
    participant Backend as Scoreboard Backend
    participant Client as Client App
    
    Note over Game: User completes action (game level, quiz, etc.)
    
    Game->>Backend: POST /internal/actions/complete
    Note over Game,Backend: { action_id, user_id, max_score }
    
    Backend->>Backend: Generate signed token
    Note over Backend: payload = action_id:user_id:max_score:expires_at<br/>token = base64(payload):hmac(payload)
    
    Backend-->>Game: { action_token, expires_at }
    
    Game-->>Client: Action completed! Here's your token
    
    Note over Client: User sees "Score +100" button
    
    Client->>Backend: PATCH /api/v1/scores
    Note over Client,Backend: { action_token, score_delta: 100 }
    
    Backend->>Backend: Validate token
    Note over Backend: 1. Decode & parse<br/>2. Verify HMAC<br/>3. Check expiry<br/>4. Match user_id<br/>5. Check score_delta ≤ max_score<br/>6. Check not consumed
    
    Backend-->>Client: { new_total_score: 1500, rank: 5 }
```

---

## Leaderboard Retrieval Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Server
    participant RD as Redis
    participant PG as PostgreSQL

    C->>API: GET /leaderboard?limit=10
    
    API->>RD: ZREVRANGE leaderboard 0 9 WITHSCORES
    
    alt Redis Available
        RD-->>API: [(user_id, score), ...]
        API->>RD: MGET user:info:* (cached usernames)
        
        alt Cache Hit
            RD-->>API: User details
        else Cache Miss
            API->>PG: SELECT username FROM users WHERE id IN (...)
            PG-->>API: User details
            API->>RD: MSET user:info:* (5min TTL)
        end
    else Redis Unavailable
        API->>PG: SELECT u.id, u.username, s.total_score<br/>FROM scores s JOIN users u<br/>ORDER BY s.total_score DESC, s.score_first_reached_at ASC<br/>LIMIT 10
        PG-->>API: Full leaderboard
    end
    
    API-->>C: { leaderboard: [...] }
```

---

## SSE Connection Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Server
    participant RD as Redis Pub/Sub

    C->>API: GET /leaderboard/stream
    Note over C,API: Accept: text/event-stream<br/>Authorization: Bearer token (optional)
    
    API->>API: Validate auth (if provided)
    API->>RD: INCR sse_conn:<user_id or ip>
    
    alt Connection Limit Exceeded
        API->>RD: DECR sse_conn:<user_id or ip>
        API-->>C: 429 Too Many Connections
    else Within Limit
        API-->>C: HTTP 200, Content-Type: text/event-stream
    
    API->>RD: SUBSCRIBE leaderboard:updates
    
    loop While Connected
        Note over API: Send keep-alive every 30s
        API-->>C: : ping
        
        RD-->>API: PUBLISH leaderboard data
        API-->>C: event: leaderboard\ndata: {"leaderboard":[...]}
    end
    
    Note over C,API: Connection closed (client or server)
        API->>RD: UNSUBSCRIBE
        API->>RD: DECR sse_conn:<user_id or ip>
    end
    
    Note over C: EventSource auto-reconnects
```

**Client Code:**
```javascript
const es = new EventSource('/api/v1/leaderboard/stream');
es.addEventListener('leaderboard', (e) => {
  updateUI(JSON.parse(e.data));
});
// Auto-reconnect on disconnect (built into EventSource)
```

---

## Session Validation Flow

```mermaid
flowchart TD
    A[Request with JWT] --> B{Parse JWT}
    B -->|Invalid| C[401 Invalid Token]
    B -->|Expired| D[401 Token Expired]
    B -->|Valid| E{Check Session in Redis}
    
    E -->|Found, Active| F[Proceed to Action Token Check]
    E -->|Found, Revoked| G[401 Session Revoked]
    E -->|Not Found| H{Check PostgreSQL}
    
    H -->|Found, Active| I[Cache in Redis]
    I --> F
    H -->|Found, Revoked| G
    H -->|Not Found| J[401 Session Not Found]
```

---

## Multi-Server Architecture

```mermaid
flowchart TB
    subgraph Clients
        C1[Client 1]
        C2[Client 2]
        C3[Client 3]
    end

    subgraph "Load Balancer"
        LB[Nginx / ALB]
    end

    subgraph "API Servers (Stateless)"
        S1[Server 1]
        S2[Server 2]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Source of Truth)]
        RD[(Redis<br/>Cache + Pub/Sub)]
    end
    
    subgraph "Logging"
        CW[CloudWatch]
    end

    C1 & C2 & C3 --> LB
    LB --> S1 & S2
    S1 & S2 <--> PG
    S1 & S2 <--> RD
    S1 & S2 -.->|logs| CW
    
    S1 -.->|Pub/Sub| RD
    S2 -.->|Pub/Sub| RD
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[PATCH /scores] --> B{JWT Valid?}
    B -->|No| C[401]
    B -->|Yes| D{Session Active?}
    
    D -->|No| E[401 Session Revoked]
    D -->|Yes| F{Action Token Valid?}
    
    F -->|No: Expired/Tampered| G[400 Invalid Token]
    F -->|No: Wrong User| G
    F -->|Yes| H{Token Already Used?}
    
    H -->|Yes| I[200 Return Cached Response]
    H -->|No| J{Rate Limit OK?}
    
    J -->|No| K[429]
    J -->|Yes| L{Validate Body}
    
    L -->|Invalid| M[400]
    L -->|score > max_score| N[400 Score Exceeds Max]
    L -->|Valid| O{DB Transaction}
    
    O -->|Success| P[200 OK]
    O -->|Failure| Q[500]
```

---

## Data Consistency Flow

```mermaid
flowchart TD
    subgraph "Score Update"
        A[Update Request] --> B[Validate Action Token]
        B --> C[PostgreSQL Transaction]
        Note1[INSERT consumed_tokens<br/>UPDATE scores<br/>INSERT score_events]
        C --> D{Success?}
        D -->|Yes| E[Update Redis Cache]
        D -->|No| F[Return Error]
    end
    
    subgraph "Redis Update"
        E --> G{Success?}
        G -->|Yes| H[Done]
        G -->|No| I[Queue Retry]
    end
    
    subgraph "Sync Job (Every 5 min)"
        J[Compare PG vs Redis Top 100] --> K{Drift > 1 entry?}
        K -->|Yes| L[Full Sync + Alert]
        K -->|No| M[Log OK]
    end
```

---

## Concurrent Update Handling

```mermaid
sequenceDiagram
    participant R1 as Request 1
    participant R2 as Request 2
    participant PG as PostgreSQL
    
    R1->>PG: BEGIN
    R1->>PG: INSERT consumed_tokens (token_A)
    R1->>PG: SELECT ... FOR UPDATE (user X)
    Note over R1,PG: Row locked
    
    R2->>PG: BEGIN
    R2->>PG: INSERT consumed_tokens (token_B)
    R2->>PG: SELECT ... FOR UPDATE (user X)
    Note over R2,PG: BLOCKED - waiting
    
    R1->>PG: UPDATE (score = 100)
    R1->>PG: INSERT score_events
    R1->>PG: COMMIT
    Note over R1,PG: Lock released
    
    Note over R2,PG: Unblocked, sees score = 100
    R2->>PG: UPDATE (score = 200)
    R2->>PG: INSERT score_events
    R2->>PG: COMMIT
```

---

## Token Replay Prevention

```mermaid
sequenceDiagram
    participant C1 as Client (Attempt 1)
    participant C2 as Client (Attempt 2 - Replay)
    participant API as API Server
    participant RD as Redis
    participant PG as PostgreSQL
    
    C1->>API: PATCH /scores (token_ABC)
    API->>RD: GET consumed:token_ABC
    RD-->>API: null (not found)
    API->>PG: INSERT consumed_tokens
    Note over API,PG: Transaction succeeds
    API->>RD: SET consumed:token_ABC = response
    API-->>C1: 200 OK (score updated)
    
    Note over C2: Same token used again
    C2->>API: PATCH /scores (token_ABC)
    API->>RD: GET consumed:token_ABC
    RD-->>API: cached response
    API-->>C2: 200 OK (cached response - no DB hit)
```