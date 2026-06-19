/** @typedef {{ claim: (key: string) => Promise<boolean> }} NotificationIdempotencyStore */

export const IDB_NAME = 'webchat-notification-idempotency';
export const IDB_STORE = 'keys';
export const IDB_VERSION = 1;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const buildPushIdempotencyKey = (notificationType, notificationData = {}) => {
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
export const claimNotificationIdempotencyKey = async (key) => {
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
