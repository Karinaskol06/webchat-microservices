/* global clients, indexedDB */

// Force a freshly-installed service worker to skip the "waiting" phase.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const FALLBACK_AVATAR_ICON_PATH = '/avatar-stub.svg';
const IDB_NAME = 'webchat-notification-idempotency';
const IDB_STORE = 'keys';
const IDB_VERSION = 1;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const openIdempotencyDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const pruneIdempotencyStore = (store, now) => {
  const expireBefore = now - IDEMPOTENCY_TTL_MS;
  const cursor = store.openCursor();
  return new Promise((resolve) => {
    const step = () => {
      cursor.onsuccess = (event) => {
        const c = event.target.result;
        if (!c) {
          resolve();
          return;
        }
        if ((c.value?.at ?? 0) < expireBefore) {
          c.delete();
        }
        c.continue();
      };
      cursor.onerror = () => resolve();
    };
    step();
  });
};

/** Returns true when this key is newly claimed and the notification may be shown. */
const claimNotificationIdempotencyKey = async (key) => {
  if (!key) return true;
  const db = await openIdempotencyDb();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const getReq = store.get(key);
    let shouldClaim = true;

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing && now - existing.at < IDEMPOTENCY_TTL_MS) {
        shouldClaim = false;
        return;
      }
      store.put({ key, at: now });
    };
    getReq.onerror = () => reject(getReq.error);

    tx.oncomplete = async () => {
      if (shouldClaim) {
        try {
          const pruneTx = db.transaction(IDB_STORE, 'readwrite');
          await pruneIdempotencyStore(pruneTx.objectStore(IDB_STORE), now);
        } catch {
          /* best-effort */
        }
      }
      resolve(shouldClaim);
    };
    tx.onerror = () => reject(tx.error);
  });
};

const buildIdempotencyKey = (notificationType, notificationData) => {
  const messageId = notificationData.messageId;
  if (messageId != null && String(messageId).length > 0) {
    return `notification:${notificationType}:${messageId}`;
  }
  if (notificationData.idempotencyKey) {
    return String(notificationData.idempotencyKey);
  }
  if (notificationType === 'room-member-invited') {
    return `notification:room-member-invited:${notificationData.inviteId || notificationData.roomId || 'pending'}`;
  }
  if (notificationData.chatId) {
    return `notification:chat:${notificationData.chatId}`;
  }
  return 'notification:message';
};

const resolveAbsoluteNotificationIcon = (candidate) => {
  if (!candidate || typeof candidate !== 'string') return null;
  const t = candidate.trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) return t;
    const path = t.startsWith('/') ? t : `/${t}`;
    return new URL(path, self.location.origin).href;
  } catch {
    return null;
  }
};

const hasVisibleWindowClient = async () => {
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  return windowClients.some((client) => client.visibilityState === 'visible');
};

const showNotificationIdempotent = async (idempotencyKey, title, options, { allowWhenVisible = false } = {}) => {
  if (!allowWhenVisible && (await hasVisibleWindowClient())) {
    return false;
  }

  const claimed = await claimNotificationIdempotencyKey(idempotencyKey);
  if (!claimed) {
    return false;
  }

  const tag = options?.tag || idempotencyKey;
  const existing = await self.registration.getNotifications({ tag });
  if (existing.length > 0) {
    return false;
  }

  await self.registration.showNotification(title, {
    ...options,
    tag,
    renotify: false,
  });
  return true;
};

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'SHOW_MESSAGE_NOTIFICATION') {
    return;
  }

  const idempotencyKey = data.idempotencyKey || data.options?.data?.idempotencyKey;
  const title = data.title || 'New message';
  const options = data.options || {};

  event.waitUntil(
    showNotificationIdempotent(idempotencyKey, title, options, { allowWhenVisible: true }),
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New message', body: event.data.text() };
  }

  const notificationData = payload.data || {};
  const notificationType = notificationData.notificationType || 'message-created';
  const senderDisplayName =
    notificationData.senderDisplayName ||
    notificationData.reactorDisplayName ||
    notificationData.inviterDisplayName ||
    payload.title ||
    'New message';
  const avatarRaw =
    payload.icon ||
    notificationData.senderAvatarUrl ||
    notificationData.reactorAvatarUrl ||
    notificationData.inviterAvatarUrl ||
    notificationData.senderProfilePicture ||
    notificationData.profilePicture ||
    null;
  const avatarIcon =
    resolveAbsoluteNotificationIcon(avatarRaw) ||
    new URL(FALLBACK_AVATAR_ICON_PATH, self.location.origin).toString();
  const idempotencyKey = buildIdempotencyKey(notificationType, notificationData);
  const options = {
    body: payload.body || 'You have a new message',
    icon: avatarIcon,
    badge: avatarIcon,
    data: { ...notificationData, idempotencyKey },
    actions: payload.actions || [],
    tag: idempotencyKey,
    renotify: false,
    requireInteraction: false,
  };

  event.waitUntil(
    showNotificationIdempotent(
      idempotencyKey,
      payload.title || senderDisplayName,
      options,
      { allowWhenVisible: true },
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const notificationType = data.notificationType || 'message-created';
  const chatId = data.chatId;
  const messageId = data.messageId;
  const inviteId = data.inviteId;
  const shouldMarkRead = event.action === 'mark-read';

  const targetUrl = new URL('/chat', self.location.origin);
  if (notificationType === 'room-member-invited') {
    if (inviteId) {
      targetUrl.searchParams.set('inviteId', inviteId);
    }
    if (data.roomId) {
      targetUrl.searchParams.set('roomId', data.roomId);
    }
    targetUrl.searchParams.set('view', 'invites');
  } else {
    if (chatId) {
      targetUrl.searchParams.set('chatId', chatId);
    }
    if (messageId) {
      targetUrl.searchParams.set('messageId', messageId);
    }
    if (shouldMarkRead && chatId) {
      targetUrl.searchParams.set('markRead', '1');
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const matchingClient = windowClients.find((client) => client.url.includes('/chat'));
      const client = matchingClient || windowClients[0];

      if (client) {
        if (shouldMarkRead && chatId) {
          client.postMessage({ type: 'MARK_CHAT_READ', chatId });
        }
        client.navigate(targetUrl.toString());
        return client.focus();
      }
      return clients.openWindow(targetUrl.toString());
    }),
  );
});
