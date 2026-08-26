/**
 * Pre-seeds users + a private-chat pool for k6 STOMP concurrency tests.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost').replace(/\/$/, '');
const USER_COUNT = Number(process.env.USER_COUNT || 300);
const CHAT_POOL_SIZE = Number(process.env.CHAT_POOL_SIZE || 50);
const PASSWORD = process.env.SEED_PASSWORD || 'Secret123!';
const CONCURRENCY = Number(process.env.SEED_CONCURRENCY || 8);

if (USER_COUNT < 2) {
  throw new Error('USER_COUNT must be >= 2');
}
if (CHAT_POOL_SIZE < 1 || CHAT_POOL_SIZE > Math.floor(USER_COUNT / 2)) {
  throw new Error(`CHAT_POOL_SIZE must be between 1 and floor(USER_COUNT/2)=${Math.floor(USER_COUNT / 2)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function postJson(urlPath, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${urlPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${urlPath} -> ${res.status} ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

function buildUser(i, runId) {
  const username = `k6u${runId}_${i}`.slice(0, 40);
  // Unique E.164-ish UA mobiles: +38050 + 7 digits from index + run salt
  const phoneTail = String((runId % 90) * 10000000 + i).padStart(9, '0').slice(-9);
  return {
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    phoneNumber: `+380${phoneTail}`,
    countryCode: 'UA',
    firstName: 'K6',
    lastName: `User${i}`,
  };
}

async function registerAndLogin(seed, index) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await postJson('/api/auth/register', seed);
      const login = await postJson('/api/auth/login', {
        username: seed.username,
        password: seed.password,
      });
      if (!login?.token || login?.id == null) {
        throw new Error(`login missing token/id for ${seed.username}`);
      }
      return {
        index,
        userId: Number(login.id),
        username: login.username || seed.username,
        token: login.token,
      };
    } catch (err) {
      lastErr = err;
      await sleep(200 * attempt);
    }
  }
  throw lastErr;
}

async function createPrivateChat(ownerToken, otherUserId) {
  const chat = await postJson('/api/chat/create', { otherUserId }, ownerToken);
  if (!chat?.id) throw new Error('create chat missing id');
  return String(chat.id);
}

async function main() {
  const runId = Date.now() % 1_000_000;
  console.log(`Seeding against ${API_BASE_URL}`);
  console.log(`USER_COUNT=${USER_COUNT} CHAT_POOL_SIZE=${CHAT_POOL_SIZE} CONCURRENCY=${CONCURRENCY}`);

  const seeds = Array.from({ length: USER_COUNT }, (_, i) => buildUser(i, runId));
  const users = await mapPool(seeds, CONCURRENCY, (seed, i) => registerAndLogin(seed, i));
  console.log(`Registered+logged-in ${users.length} users`);

  // Chat j is between user[j] and user[j + CHAT_POOL_SIZE] so both are valid members.
  const chatIndexes = Array.from({ length: CHAT_POOL_SIZE }, (_, j) => j);
  const chats = await mapPool(chatIndexes, CONCURRENCY, async (j) => {
    const owner = users[j];
    const peer = users[j + CHAT_POOL_SIZE];
    const chatId = await createPrivateChat(owner.token, peer.userId);
    return {
      chatId,
      memberUserIndexes: [j, j + CHAT_POOL_SIZE],
    };
  });
  console.log(`Created ${chats.length} private chats`);

  const payload = {
    createdAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    userCount: USER_COUNT,
    chatPoolSize: CHAT_POOL_SIZE,
    note:
      'VU i uses users[i].token and chats[i % chatPoolSize].chatId. Prefer i < userCount. Connection-scale test; multiple VUs may share a chat topic.',
    users: users.map((u) => ({
      index: u.index,
      userId: u.userId,
      username: u.username,
      token: u.token,
    })),
    chats: chats.map((c, j) => ({
      index: j,
      chatId: c.chatId,
      memberUserIndexes: c.memberUserIndexes,
    })),
  };

  const outDir = path.join(__dirname, 'data');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'sessions.json');
  await writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
