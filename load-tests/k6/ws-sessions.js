/**
 * Concurrent STOMP sessions (CONNECT + subscribe) — connection-scale / "app open".
 *
 * Topology: many chats — VU i uses chats[i % poolSize].
 * Hold: each session stays subscribed for HOLD_SECONDS (default 120s) after SUBSCRIBE.
 *
 * Transport: raw WebSocket STOMP at /ws/chat (registered alongside SockJS in WebSocketConfig).
 */

import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import ws from 'k6/ws';
import { Counter, Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

const SESSIONS_FILE = __ENV.SESSIONS_FILE || '../data/sessions.json';
const WS_BASE_URL = (__ENV.WS_BASE_URL || 'ws://localhost').replace(/\/$/, '');
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 120);
const RAMP_SECONDS = Number(__ENV.RAMP_SECONDS || 30);
const STEP1 = Number(__ENV.STEP1_VUS || 100);
const STEP2 = Number(__ENV.STEP2_VUS || 200);
const STEP3 = Number(__ENV.STEP3_VUS || 300);
/** Allow timer vs wall-clock slack when recording a successful hold. */
const HOLD_TOLERANCE_MS = Number(__ENV.HOLD_TOLERANCE_MS || 3000);
const HEARTBEAT_MS = Number(__ENV.STOMP_HEARTBEAT_MS || 10000);

const connectOk = new Rate('stomp_connect_ok');
const subscribeOk = new Rate('stomp_subscribe_ok');
const sessionHeld = new Rate('stomp_session_held');
const connectLatency = new Trend('stomp_connect_ms', true);
const holdDurationMs = new Trend('stomp_hold_duration_ms', true);
const stompProtocolErrors = new Counter('stomp_protocol_errors');
const wsHandshakeFailures = new Counter('ws_handshake_failures');
const sessionInterrupted = new Counter('stomp_session_interrupted');

const sessions = new SharedArray('sessions', () => {
  const data = JSON.parse(open(SESSIONS_FILE));
  if (!data.users?.length || !data.chats?.length) {
    throw new Error(`Invalid sessions file: ${SESSIONS_FILE}`);
  }
  return [data];
});

export const options = {
  scenarios: {
    stomp_session_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_SECONDS}s`, target: STEP1 },
        { duration: `${HOLD_SECONDS}s`, target: STEP1 },
        { duration: `${RAMP_SECONDS}s`, target: STEP2 },
        { duration: `${HOLD_SECONDS}s`, target: STEP2 },
        { duration: `${RAMP_SECONDS}s`, target: STEP3 },
        { duration: `${HOLD_SECONDS}s`, target: STEP3 },
        { duration: `${RAMP_SECONDS}s`, target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    stomp_connect_ok: ['rate>0.99'],
    stomp_subscribe_ok: ['rate>0.99'],
    stomp_session_held: ['rate>0.99'],
    stomp_protocol_errors: ['count<10'],
    ws_handshake_failures: ['count<10'],
  },
};

function stompFrame(command, headers, body) {
  let frame = `${command}\n`;
  for (const [k, v] of Object.entries(headers || {})) {
    frame += `${k}:${v}\n`;
  }
  frame += `\n${body || ''}\0`;
  return frame;
}

function parseStompFrame(data) {
  if (!data || typeof data !== 'string') {
    return { command: null, headers: {} };
  }
  const nullIdx = data.indexOf('\0');
  const chunk = nullIdx >= 0 ? data.slice(0, nullIdx) : data;
  const parts = chunk.split('\n');
  const command = (parts[0] || '').trim();
  const headers = {};
  for (let i = 1; i < parts.length; i += 1) {
    const line = parts[i];
    if (line === '') break;
    const colon = line.indexOf(':');
    if (colon > 0) {
      headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  return { command, headers };
}

function parseHeartbeatMs(headers) {
  const raw = headers['heart-beat'] || headers['Heart-Beat'];
  if (!raw) return HEARTBEAT_MS;
  const [cx] = raw.split(',').map((v) => Number(v.trim()));
  if (Number.isFinite(cx) && cx > 0) return cx;
  return HEARTBEAT_MS;
}

export default function () {
  const data = sessions[0];
  const vuIndex = (__VU - 1) % data.users.length;
  const user = data.users[vuIndex];
  const chat = data.chats[vuIndex % data.chats.length];
  const url = `${WS_BASE_URL}/ws/chat`;
  const holdMs = HOLD_SECONDS * 1000;

  const started = Date.now();
  let gotConnected = false;
  let gotSubscribed = false;
  let sawStompError = false;
  let subscribedAt = null;
  let holdFinished = false;
  let outcomeRecorded = false;

  const recordOutcome = (success, reason) => {
    if (outcomeRecorded) return;
    outcomeRecorded = true;
    if (subscribedAt != null) {
      holdDurationMs.add(Date.now() - subscribedAt);
    }
    if (success) {
      sessionHeld.add(true);
      return;
    }
    if (reason === 'interrupted') {
      sessionInterrupted.add(1);
      return;
    }
    sessionHeld.add(false);
  };

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(
        stompFrame('CONNECT', {
          'accept-version': '1.1,1.2',
          'heart-beat': `${HEARTBEAT_MS},${HEARTBEAT_MS}`,
          Authorization: `Bearer ${user.token}`,
        }),
      );
    });

    socket.on('message', (msg) => {
      const { command, headers } = parseStompFrame(msg);

      if (command === 'CONNECTED' && !gotConnected) {
        gotConnected = true;
        connectLatency.add(Date.now() - started);
        connectOk.add(true);

        const hbMs = parseHeartbeatMs(headers);
        socket.setInterval(() => {
          socket.send('\n');
        }, hbMs);

        socket.send(
          stompFrame('SUBSCRIBE', {
            id: `sub-${__VU}-${__ITER}`,
            destination: `/topic/chat/${chat.chatId}/messages`,
            ack: 'auto',
          }),
        );
        socket.send(
          stompFrame('SUBSCRIBE', {
            id: `sub-presence-${__VU}-${__ITER}`,
            destination: `/topic/chat/${chat.chatId}/presence`,
            ack: 'auto',
          }),
        );

        gotSubscribed = true;
        subscribeOk.add(true);
        subscribedAt = Date.now();

        socket.setTimeout(() => {
          holdFinished = true;
          recordOutcome(true, 'held');
          socket.send(stompFrame('DISCONNECT', { receipt: `rcpt-${__VU}-${__ITER}` }));
          socket.close();
        }, holdMs);
        return;
      }

      if (command === 'ERROR') {
        sawStompError = true;
        stompProtocolErrors.add(1);
        recordOutcome(false, 'stomp_error');
        socket.close();
      }
    });

    socket.on('close', () => {
      // Timers are cancelled automatically when the socket closes (k6/ws).

      if (outcomeRecorded) return;

      if (sawStompError) {
        recordOutcome(false, 'stomp_error');
        return;
      }

      if (!gotConnected) {
        connectOk.add(false);
        recordOutcome(false, 'no_connect');
        return;
      }

      if (!gotSubscribed) {
        subscribeOk.add(false);
        recordOutcome(false, 'no_subscribe');
        return;
      }

      const heldMs = Date.now() - subscribedAt;
      if (holdFinished || heldMs >= holdMs - HOLD_TOLERANCE_MS) {
        recordOutcome(true, 'held_on_close');
        return;
      }

      // Early close during ramp-down / VU interrupt — do not penalize sessionHeld rate.
      recordOutcome(false, 'interrupted');
    });
  });

  const handshakeOk = check(res, {
    'ws status 101': (r) => r && r.status === 101,
  });

  if (!handshakeOk) {
    wsHandshakeFailures.add(1);
    connectOk.add(false);
    subscribeOk.add(false);
    sessionHeld.add(false);
  }

  sleep(0.2);
}

export function handleSummary(data) {
  const held = data.metrics.stomp_session_held;
  const interrupted = data.metrics.stomp_session_interrupted;
  const holdTrend = data.metrics.stomp_hold_duration_ms;

  const heldRate = held?.values?.rate;
  const heldPass = held?.thresholds?.['rate>0.99']?.ok;
  const interruptedCount = interrupted?.values?.count ?? 0;
  const holdP95 = holdTrend?.values?.['p(95)'];

  console.log('');
  console.log('=== WEBCHAT STOMP HOLD SUMMARY ===');
  if (heldRate != null) {
    console.log(`stomp_session_held rate: ${(heldRate * 100).toFixed(2)}% (threshold pass: ${heldPass})`);
  }
  console.log(`sessions interrupted (ramp/teardown, excluded from held rate): ${interruptedCount}`);
  if (holdP95 != null) {
    console.log(`hold duration p95: ${holdP95.toFixed(0)} ms (target ~${HOLD_SECONDS * 1000} ms)`);
  }
  console.log(`Hint: highest stage where stomp_session_held >= 99% and connect/subscribe >= 99%`);
  console.log('');

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'data/k6-ws-sessions-summary.json': JSON.stringify(data, null, 2),
  };
}
