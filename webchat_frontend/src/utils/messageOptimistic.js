export const isOptimisticMessageId = (id) => String(id ?? '').startsWith('optimistic-');

/** Resolve the server id used for REST mutations (edit/delete/reactions). */
export const resolveMessageId = (message) => {
  const raw = message?.id ?? message?._id ?? message?.messageId;
  if (raw == null || raw === '') return null;
  return String(raw);
};

/** Unique client id for an in-flight optimistic bubble. */
export const createOptimisticMessageId = () =>
  `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const messageContentKey = (message) => String(message?.content ?? '').trim();

const messageSenderKey = (message) =>
  Number(message?.senderId ?? message?.sender?.id);

const messageChatKey = (message) =>
  message?.chatId != null ? String(message.chatId) : '';

/** Stable key to match optimistic placeholders with their server echo. */
export const messageSendSignature = (message) => {
  const chatKey = messageChatKey(message);
  const senderKey = messageSenderKey(message);
  const contentKey = messageContentKey(message);
  if (!chatKey || Number.isNaN(senderKey)) return null;
  return `${chatKey}|${senderKey}|${contentKey}`;
};

/**
 * When a confirmed server message arrives, drop exactly one matching optimistic
 * placeholder (same chat, sender, and text). FIFO — important for burst sends.
 */
export const removeOneMatchingOptimistic = (messages, confirmed) => {
  const chatKey = messageChatKey(confirmed);
  const senderKey = messageSenderKey(confirmed);
  const contentKey = messageContentKey(confirmed);
  if (!chatKey || Number.isNaN(senderKey)) {
    return messages;
  }

  let removed = false;
  return messages.filter((m) => {
    if (removed) return true;
    if (!isOptimisticMessageId(m.id)) return true;
    if (messageChatKey(m) !== chatKey) return true;
    if (messageSenderKey(m) !== senderKey) return true;
    if (messageContentKey(m) !== contentKey) return true;
    removed = true;
    return false;
  });
};
