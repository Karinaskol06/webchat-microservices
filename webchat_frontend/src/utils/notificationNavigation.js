import { WEBCHAT_OPEN_CHAT_NOTIFICATION } from '../constants/chatEvents';

export const NOTIFICATION_NAV_IDB_NAME = 'webchat-notification-idempotency';
export const NOTIFICATION_NAV_IDB_STORE = 'keys';
export const PENDING_CHAT_NAV_KEY = 'pending-chat-navigation';
const PENDING_NAV_TTL_MS = 5 * 60 * 1000;

const listeners = new Set();

const openIdb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTIFICATION_NAV_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTIFICATION_NAV_IDB_STORE)) {
        db.createObjectStore(NOTIFICATION_NAV_IDB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Read and clear a navigation intent stashed by the service worker. */
export async function consumePendingChatNavigation() {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openIdb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_NAV_IDB_STORE, 'readonly');
      const req = tx.objectStore(NOTIFICATION_NAV_IDB_STORE).get(PENDING_CHAT_NAV_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!record?.payload?.chatId) return null;
    if (Date.now() - (record.at ?? 0) > PENDING_NAV_TTL_MS) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(NOTIFICATION_NAV_IDB_STORE, 'readwrite');
        tx.objectStore(NOTIFICATION_NAV_IDB_STORE).delete(PENDING_CHAT_NAV_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return null;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_NAV_IDB_STORE, 'readwrite');
      tx.objectStore(NOTIFICATION_NAV_IDB_STORE).delete(PENDING_CHAT_NAV_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return normalizeNavigationDetail(record.payload);
  } catch {
    return null;
  }
}

export function normalizeNavigationDetail(raw) {
  const chatId = raw?.chatId;
  if (chatId == null || chatId === '') return null;
  return {
    chatId: String(chatId),
    messageId: raw?.messageId != null ? String(raw.messageId) : null,
    focusComposer: Boolean(raw?.focusComposer),
    markRead: Boolean(raw?.markRead),
  };
}

export function publishNotificationNavigation(raw) {
  const detail = normalizeNavigationDetail(raw);
  if (!detail) return;
  listeners.forEach((listener) => {
    try {
      listener(detail);
    } catch {
      /* subscriber error */
    }
  });
  window.dispatchEvent(
    new CustomEvent(WEBCHAT_OPEN_CHAT_NOTIFICATION, { detail }),
  );
}

export function subscribeNotificationNavigation(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export async function drainPendingNotificationNavigation() {
  const pending = await consumePendingChatNavigation();
  if (pending) {
    publishNotificationNavigation(pending);
  }
}
