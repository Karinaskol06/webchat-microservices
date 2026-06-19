const MESSAGE_SEEN_TTL_MS = 5 * 60 * 1000;
const MAX_TRACKED_ENTRIES = 500;

const seenIncomingMessages = new Map();

const pruneMap = (map, ttlMs, now = Date.now()) => {
  for (const [key, timestamp] of map) {
    if (now - timestamp > ttlMs) {
      map.delete(key);
    }
  }
  if (map.size <= MAX_TRACKED_ENTRIES) return;
  const overflow = map.size - MAX_TRACKED_ENTRIES;
  const keys = [...map.keys()];
  for (let i = 0; i < overflow; i += 1) {
    map.delete(keys[i]);
  }
};

/** Canonical message id across topic, queue, inbox, and push payloads. */
export const getMessageId = (message) => {
  if (!message || typeof message !== 'object') return null;
  const raw = message.id ?? message._id ?? message.messageId;
  if (raw == null || String(raw).length === 0) return null;
  return String(raw);
};

export const getIncomingMessageDedupKey = (message) => {
  const messageId = getMessageId(message);
  if (messageId) return `msg:${messageId}`;

  if (!message || typeof message !== 'object') return null;
  const chatId = message.chatId ?? '';
  const timestamp = message.timestamp ?? '';
  const senderId = message.senderId ?? message.sender?.id ?? '';
  if (!chatId && !timestamp) return null;
  return `fallback:${chatId}:${timestamp}:${senderId}`;
};

/** First WebSocket delivery wins; later topic/queue duplicates are ignored. */
export const claimIncomingMessage = (message) => {
  const key = getIncomingMessageDedupKey(message);
  if (!key) return true;

  const now = Date.now();
  const seenAt = seenIncomingMessages.get(key);
  if (seenAt != null && now - seenAt < MESSAGE_SEEN_TTL_MS) {
    return false;
  }

  seenIncomingMessages.set(key, now);
  pruneMap(seenIncomingMessages, MESSAGE_SEEN_TTL_MS, now);
  return true;
};

/** Idempotency key shared with the service worker IndexedDB store. */
export const buildNotificationIdempotencyKey = (
  message,
  chatId,
  notificationType = 'message-created',
) => {
  const messageId = getMessageId(message);
  if (messageId) {
    return `notification:${notificationType}:${messageId}`;
  }
  if (notificationType === 'room-member-invited') {
    const inviteId = message?.inviteId ?? chatId;
    return `notification:room-member-invited:${inviteId || 'pending'}`;
  }
  return chatId ? `notification:chat:${chatId}` : 'notification:message';
};

/** @deprecated use buildNotificationIdempotencyKey */
export const buildNotificationTag = (message, chatId, notificationType) =>
  buildNotificationIdempotencyKey(message, chatId, notificationType);
