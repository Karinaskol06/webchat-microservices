export const isOptimisticMessageId = (id) => String(id ?? '').startsWith('optimistic-');

/** Unique client id for an in-flight optimistic bubble. */
export const createOptimisticMessageId = () =>
  `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const messageContentKey = (message) => String(message?.content ?? '').trim();

const messageSenderKey = (message) =>
  Number(message?.senderId ?? message?.sender?.id);

const messageChatKey = (message) =>
  message?.chatId != null ? String(message.chatId) : '';

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
