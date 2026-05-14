const storageKey = (userId, chatId) =>
  `webchat:lastReadEdge:${String(userId)}:${String(chatId)}`;

/**
 * Last read boundary for a chat session: messages at or before this time are treated as read.
 */
export function getLastReadEdge(userId, chatId) {
  if (userId == null || chatId == null || chatId === '') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(userId, chatId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setLastReadEdge(userId, chatId, edge) {
  if (userId == null || chatId == null || chatId === '') return;
  if (!edge?.timestamp) return;
  try {
    sessionStorage.setItem(storageKey(userId, chatId), JSON.stringify(edge));
  } catch {
    // quota / private mode
  }
}

export function persistReadEdgeFromMessages(userId, chatId, messages) {
  if (userId == null || chatId == null || chatId === '') return;
  if (!Array.isArray(messages) || messages.length === 0) {
    setLastReadEdge(userId, chatId, { timestamp: new Date().toISOString() });
    return;
  }
  let max = 0;
  for (const m of messages) {
    const t = new Date(m.timestamp).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  setLastReadEdge(userId, chatId, {
    timestamp: new Date(max).toISOString(),
  });
}
