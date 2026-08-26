# Load tests — concurrent STOMP sessions

## What this measures

**This:** how many clients can stay **connected + subscribed** (“app open”) before errors exceed **1%**.

| Setting | Value |
|--------|--------|
| Session | STOMP `CONNECT` + `SUBSCRIBE` to `/topic/chat/{id}/messages` (+ presence topic) |
| Topology | Many chats: VU `i` → `chats[i % poolSize]` |
| Auth | Pre-seeded JWTs (`data/sessions.json`) |
| Transport | Raw WebSocket STOMP at `/ws/chat` (already registered next to SockJS in `WebSocketConfig`) |
| Ramp | 0→100→200→300 VUs, ~2 min hold each |
| Success **N** | Highest step where `stomp_connect_ok`, `stomp_subscribe_ok`, and `stomp_session_held` are all **≥ 99%** |
| Hold | Each session stays subscribed **`HOLD_SECONDS`** (default 120s); STOMP `\n` heartbeats keep the socket alive |

Local Kubernetes / laptop only.

## Prerequisites

1. Stack reachable (e.g. Ingress `http://localhost`, WS `ws://localhost`)
2. [k6](https://k6.io/docs/get-started/installation/) installed (`k6 version`)
3. Node 18+ (`node` for the seed script)

## 1) Seed users + chat pool

From `load-tests/`:

```bat
cd C:\Java\webchat\load-tests
set API_BASE_URL=http://localhost
set USER_COUNT=300
set CHAT_POOL_SIZE=50
node seed-sessions.mjs
```

Writes `data/sessions.json` (gitignored). Re-seed if tokens expire.

## 2) Run the ramp

```bat
cd C:\Java\webchat\load-tests
set WS_BASE_URL=ws://localhost
k6 run k6/ws-sessions.js
```

Optional env:

| Env | Default | Meaning |
|-----|---------|---------|
| `WS_BASE_URL` | `ws://localhost` | Origin for `/ws/chat` |
| `SESSIONS_FILE` | `../data/sessions.json` | Seed file (path relative to the k6 script) |
| `STEP1_VUS` / `STEP2_VUS` / `STEP3_VUS` | 100 / 200 / 300 | Ramp targets |
| `HOLD_SECONDS` | 120 | Seconds to stay subscribed after SUBSCRIBE |
| `HOLD_TOLERANCE_MS` | 3000 | Slack when judging a successful hold |
| `STOMP_HEARTBEAT_MS` | 10000 | Client heartbeat interval (STOMP `\n` frames) |
| `RAMP_SECONDS` | 30 | Time to ramp between steps |

If the run **fails thresholds** at 300, re-run with a lower ceiling and treat the last green hold as **N**:

```bat
set STEP3_VUS=200
k6 run k6/ws-sessions.js
```

Summary JSON: `data/k6-ws-sessions-summary.json`.

### Reading the results

| Metric | Meaning |
|--------|---------|
| `stomp_connect_ok` / `stomp_subscribe_ok` | CONNECT + SUBSCRIBE succeeded |
| `stomp_session_held` | Stayed subscribed for ~`HOLD_SECONDS` (successful hold) |
| `stomp_hold_duration_ms` | How long each session stayed subscribed (p95 should be ~120000) |
| `stomp_session_interrupted` | Closed early during ramp/teardown — **not** counted as a failed hold |
| `stomp_protocol_errors` | STOMP ERROR frames only (not normal disconnect noise) |

Quick smoke (short hold):

```bat
set HOLD_SECONDS=15
set STEP3_VUS=30
k6 run k6/ws-sessions.js
```

## Notes

- This test = **connection capacity** (many VUs, subscribe only — no message write storm).
- Product “online” in Redis is separate (`/api/presence`); this test does not claim Redis presence scale.
- In-memory STOMP broker (`enableSimpleBroker`) limits scale vs an external broker.
