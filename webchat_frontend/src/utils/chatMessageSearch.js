/** Text shown in the bubble — used for match indices and highlights. */
export function getMessageSearchableText(message) {
  if (!message) return '';
  return String(message.content || '');
}

/**
 * Substring search (unfinished words). Returns one entry per occurrence in message order.
 */
export function findInChatMessageMatches(messages, rawQuery) {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return [];

  const matches = [];
  const list = Array.isArray(messages) ? messages : [];

  for (const message of list) {
    const messageId = message?.id ?? message?._id;
    if (messageId == null) continue;

    const text = getMessageSearchableText(message);
    if (!text) continue;

    const lower = text.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(query, from);
      if (index === -1) break;
      matches.push({
        messageId: String(messageId),
        start: index,
        end: index + query.length,
      });
      from = index + 1;
    }
  }

  return matches;
}
