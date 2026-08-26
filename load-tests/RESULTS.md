# Concurrent STOMP session results

## Environment

- Date: 2026-08-24
- Machine: local laptop / Docker Desktop Kubernetes (`webchat-dev`)
- API / WS base: `http://localhost` / `ws://localhost`
- Seed: USER_COUNT=300 / CHAT_POOL_SIZE=50
- k6 steps: STEP1=100 / STEP2=200 / STEP3=300 / HOLD_SECONDS=120
- Transport: raw WebSocket STOMP at `/ws/chat` (CONNECT + SUBSCRIBE + heartbeats)

## Outcomes

| Step (VUs) | Hold OK? (&lt;1% errors) | Notes |
|------------|------------------------|--------|
| 100 | Yes | Part of continuous ramp; connect/subscribe/hold 100% on completed sessions |
| 200 | Yes | Same |
| 300 | Yes | Peak concurrent VUs reached; all thresholds passed |

**Last green N:** 300

**Hold duration p95:** 120,001 ms (target 120,000 ms)

**Connect latency p95:** ~16 ms (median ~8 ms)

**Connect / subscribe / hold success:** 100% (`stomp_connect_ok`, `stomp_subscribe_ok`, `stomp_session_held`)

**STOMP protocol errors / WS handshake failures:** 0

**Interrupted sessions:** 226 (ramp/teardown — informational, not a failed hold)

**Completed held sessions:** 673
