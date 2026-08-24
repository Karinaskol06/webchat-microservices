import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8089';
const SAMPLE_COUNT = Number(process.env.REALTIME_SAMPLE_COUNT ?? 20);
const EVENT_TIMEOUT_MS = Number(
  process.env.REALTIME_EVENT_TIMEOUT_MS ?? (SAMPLE_COUNT >= 50 ? 30_000 : 20_000),
);
const INTER_MESSAGE_DELAY_MS = Number(process.env.REALTIME_INTER_MESSAGE_DELAY_MS ?? 75);

const percentile = (values, p) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
};

const createUserSeed = (label) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100_000)}`;
  const username = `e2e_${label}_${suffix}`.slice(0, 40);
  return {
    username,
    password: 'Secret123!',
    email: `${username}@example.com`,
    phoneNumber: '+380501112233',
    countryCode: 'UA',
    firstName: 'E2E',
    lastName: label,
  };
};

const registerAndLogin = async (request, label) => {
  const seed = createUserSeed(label);

  const registerRes = await request.post(`${API_BASE_URL}/api/auth/register`, {
    data: seed,
    failOnStatusCode: false,
  });
  if (!registerRes.ok()) {
    const body = await registerRes.text();
    throw new Error(`Register failed for ${label}: ${registerRes.status()} ${body}`);
  }

  const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { username: seed.username, password: seed.password },
    failOnStatusCode: false,
  });
  if (!loginRes.ok()) {
    const body = await loginRes.text();
    throw new Error(`Login failed for ${label}: ${loginRes.status()} ${body}`);
  }

  const loginJson = await loginRes.json();
  if (!loginJson?.token || !loginJson?.id) {
    throw new Error(`Login response missing token/id for ${label}`);
  }

  return {
    userId: Number(loginJson.id),
    token: loginJson.token,
    username: loginJson.username ?? seed.username,
  };
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const createPrivateChat = async (request, ownerToken, otherUserId) => {
  const response = await request.post(`${API_BASE_URL}/api/chat/create`, {
    headers: authHeaders(ownerToken),
    data: { otherUserId },
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Create chat failed: ${response.status()} ${body}`);
  }
  const chat = await response.json();
  if (!chat?.id) throw new Error('Create chat response missing chat id');
  return String(chat.id);
};

const postPresenceEnter = async (request, token, chatId) => {
  const response = await request.post(`${API_BASE_URL}/api/presence/enter-chat/${chatId}`, {
    headers: authHeaders(token),
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`enter-chat failed: ${response.status()} ${body}`);
  }
};

const postPresenceAfk = async (request, token, chatId) => {
  const response = await request.post(`${API_BASE_URL}/api/presence/afk/${chatId}`, {
    headers: authHeaders(token),
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`afk failed: ${response.status()} ${body}`);
  }
};

const readPresenceStatus = async (request, token, userId, chatId) => {
  const response = await request.get(`${API_BASE_URL}/api/presence/status/${userId}/${chatId}`, {
    headers: authHeaders(token),
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`presence status failed: ${response.status()} ${body}`);
  }
  return response.json();
};

const sendProbeRichMessage = async (request, token, chatId, marker) => {
  const response = await request.post(`${API_BASE_URL}/api/chat/${chatId}/rich-messages`, {
    headers: authHeaders(token),
    data: { type: 'CALLOUT', content: JSON.stringify({ text: marker }) },
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`send message failed: ${response.status()} ${body}`);
  }
};

const createAuthedPage = async (browser, token) => {
  const context = await browser.newContext();
  await context.addInitScript((storedToken) => {
    localStorage.setItem('token', storedToken);
  }, token);
  const page = await context.newPage();
  await page.goto('/login');
  return { context, page };
};

const ensureWsConnected = async (page, timeoutMs) => {
  await page.evaluate(async (timeout) => {
    const ws = await import('/src/utils/websocket.js');
    await ws.waitForWebSocketConnection(timeout);
  }, timeoutMs);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const measureOneSample = async (request, receiverPage, chatId, senderToken, index) => {
  const marker = `latency_probe_${Date.now()}_${index}`;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await ensureWsConnected(receiverPage, EVENT_TIMEOUT_MS);
      const waitPromise = waitForIncomingMessage(receiverPage, chatId, marker, EVENT_TIMEOUT_MS);
      const sentAt = Date.now();
      await sendProbeRichMessage(request, senderToken, chatId, marker);
      const { receivedAt } = await waitPromise;
      return receivedAt - sentAt;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(250);
      }
    }
  }

  throw lastError ?? new Error(`Failed to measure sample ${index}`);
};

const waitForIncomingMessage = async (page, chatId, expectedContent, timeoutMs) =>
  page.evaluate(
    async ({ inChatId, marker, timeout }) => {
      const ws = await import('/src/utils/websocket.js');
      await ws.waitForWebSocketConnection(timeout);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe?.();
          reject(new Error(`Timeout waiting for marker ${marker}`));
        }, timeout);

        const unsubscribe = ws.subscribeToChat(String(inChatId), {
          onMessage: (msg) => {
            const raw = msg?.content;
            const messageText =
              typeof raw === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(raw);
                      return parsed?.text ?? raw;
                    } catch {
                      return raw;
                    }
                  })()
                : raw?.text;
            if (messageText !== marker) return;
            clearTimeout(timer);
            unsubscribe?.();
            resolve({ receivedAt: Date.now() });
          },
        });
      });
    },
    { inChatId: chatId, marker: expectedContent, timeout: timeoutMs },
  );

const waitForPresenceEvent = async (page, chatId, targetUserId, timeoutMs) => {
  await page.evaluate(
    async ({ inChatId, userId, timeout }) => {
      window.__presenceBench = { done: false, eventAt: null };
      window.__presenceBenchReady = false;

      const ws = await import('/src/utils/websocket.js');
      await ws.waitForWebSocketConnection(timeout);

      const unsubscribe = ws.subscribeToChat(String(inChatId), {
        onPresence: (event) => {
          if (Number(event?.userId) !== Number(userId)) return;
          window.__presenceBench = { done: true, eventAt: Date.now(), event };
          unsubscribe?.();
        },
      });

      window.__presenceBenchReady = true;
    },
    { inChatId: chatId, userId: targetUserId, timeout: timeoutMs },
  );

  await page.waitForFunction(() => window.__presenceBenchReady === true, {
    timeout: timeoutMs,
  });

  return {
    awaitEvent: async (presenceStartAt) => {
      await page.waitForFunction(() => window.__presenceBench?.done === true, {
        timeout: timeoutMs,
      });
      const eventAt = await page.evaluate(() => window.__presenceBench.eventAt);
      return { eventAt, delayMs: eventAt - presenceStartAt };
    },
  };
};

test.describe('Realtime latency and presence (live backend)', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !process.env.REALTIME_E2E,
    'Set REALTIME_E2E=1 to run live latency/presence measurements.',
  );

  test('measures e2e message latency and presence propagation', async ({ browser, request }, testInfo) => {
    // Default Playwright timeout (30s) is too low for large sample counts.
    test.setTimeout(Math.max(120_000, SAMPLE_COUNT * 4_000 + 90_000));

    const sender = await registerAndLogin(request, 'sender');
    const receiver = await registerAndLogin(request, 'receiver');
    const chatId = await createPrivateChat(request, sender.token, receiver.userId);

    const senderSession = await createAuthedPage(browser, sender.token);
    const receiverSession = await createAuthedPage(browser, receiver.token);

    try {
      await postPresenceEnter(request, sender.token, chatId);
      await postPresenceEnter(request, receiver.token, chatId);
      await ensureWsConnected(receiverSession.page, EVENT_TIMEOUT_MS);

      const presenceWait = await waitForPresenceEvent(
        receiverSession.page,
        chatId,
        sender.userId,
        EVENT_TIMEOUT_MS,
      );
      const presenceStartAt = Date.now();
      await postPresenceAfk(request, sender.token, chatId);
      const wsPresence = await presenceWait.awaitEvent(presenceStartAt);
      const wsPresenceDelayMs = wsPresence.delayMs;

      let statusDelayMs = null;
      const statusDeadline = Date.now() + EVENT_TIMEOUT_MS;
      while (Date.now() < statusDeadline) {
        const status = await readPresenceStatus(request, receiver.token, sender.userId, chatId);
        if (status?.isAfk === true) {
          statusDelayMs = Date.now() - presenceStartAt;
          break;
        }
        await sleep(200);
      }

      await postPresenceEnter(request, sender.token, chatId);

      const latencies = [];
      for (let i = 0; i < SAMPLE_COUNT; i += 1) {
        latencies.push(await measureOneSample(
          request,
          receiverSession.page,
          chatId,
          sender.token,
          i,
        ));
        if (i + 1 < SAMPLE_COUNT) {
          await sleep(INTER_MESSAGE_DELAY_MS);
        }
      }

      const result = {
        sampleCount: latencies.length,
        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        minMs: Math.min(...latencies),
        maxMs: Math.max(...latencies),
        wsPresenceDelayMs,
        statusPresenceDelayMs: statusDelayMs,
        chatId,
      };

      await testInfo.attach('realtime-metrics', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });

      console.log(`REALTIME_METRIC message_p95_ms=${result.p95Ms} samples=${result.sampleCount}`);
      console.log(`REALTIME_METRIC presence_ws_delay_ms=${result.wsPresenceDelayMs}`);
      if (result.statusPresenceDelayMs != null) {
        console.log(`REALTIME_METRIC presence_status_delay_ms=${result.statusPresenceDelayMs}`);
      }

      expect(result.sampleCount).toBeGreaterThan(0);
      expect(result.p95Ms).not.toBeNull();
      expect(result.wsPresenceDelayMs).toBeGreaterThanOrEqual(0);
    } finally {
      await senderSession.context.close();
      await receiverSession.context.close();
    }
  });
});
