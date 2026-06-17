const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const mediaCache = new Map();
const deletedMessageIdsByRoom = new Map();
const deletedAttachmentIdsByRoom = new Map();

export function readSharedMediaCache(roomId) {
  if (!roomId) return null;
  return mediaCache.get(String(roomId)) ?? null;
}

export function writeSharedMediaCache(roomId, attachments, links) {
  if (!roomId) return;
  mediaCache.set(String(roomId), {
    attachments: Array.isArray(attachments) ? attachments : [],
    links: Array.isArray(links) ? links : [],
  });
}

export function invalidateSharedMediaCache(roomId) {
  if (!roomId) return;
  mediaCache.delete(String(roomId));
}

function deletedSet(map, roomId) {
  const key = String(roomId);
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  return map.get(key);
}

export function recordSharedMediaMessageDeleted(roomId, messageId) {
  if (!roomId || messageId == null || messageId === '') return;
  deletedSet(deletedMessageIdsByRoom, roomId).add(String(messageId));
  invalidateSharedMediaCache(roomId);
}

export function recordSharedMediaAttachmentDeleted(roomId, messageId, attachmentId) {
  if (!roomId || attachmentId == null || attachmentId === '') return;
  deletedSet(deletedAttachmentIdsByRoom, roomId).add(String(attachmentId));
  invalidateSharedMediaCache(roomId);
}

export function getSharedMediaDeletionState(roomId) {
  if (!roomId) {
    return {
      deletedMessageIds: new Set(),
      deletedAttachmentIds: new Set(),
    };
  }
  const key = String(roomId);
  return {
    deletedMessageIds: new Set(deletedMessageIdsByRoom.get(key) ?? []),
    deletedAttachmentIds: new Set(deletedAttachmentIdsByRoom.get(key) ?? []),
  };
}

export function clearSharedMediaDeletionState(roomId) {
  if (!roomId) return;
  const key = String(roomId);
  deletedMessageIdsByRoom.delete(key);
  deletedAttachmentIdsByRoom.delete(key);
}

function liveMessageAttachments(messages) {
  return (Array.isArray(messages) ? messages : []).flatMap((msg) =>
    Array.isArray(msg?.attachments) ? msg.attachments : [],
  );
}

export const formatFileSize = (bytes) => {
  if (bytes == null || Number.isNaN(Number(bytes))) return '';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (a) =>
  a?.isImage || a?.fileType === 'IMAGE' || (a?.mimeType || '').startsWith('image/');

const isVideo = (a) =>
  a?.fileType === 'VIDEO' || (a?.mimeType || '').startsWith('video/');

const isAudioMime = (a) => (a?.mimeType || '').startsWith('audio/');

const isVoiceAttachment = (a) => {
  const mime = (a?.mimeType || '').toLowerCase();
  const name = (a?.filename || '').toLowerCase();
  return mime.includes('ogg') || mime === 'audio/webm' || name.includes('voice');
};

export const categorizeAttachments = (attachments) => {
  const photos = [];
  const videos = [];
  const files = [];
  const audio = [];
  const voice = [];

  (Array.isArray(attachments) ? attachments : []).forEach((a) => {
    if (isImage(a)) {
      photos.push(a);
      return;
    }
    if (isVideo(a)) {
      videos.push(a);
      return;
    }
    if (isAudioMime(a)) {
      if (isVoiceAttachment(a)) voice.push(a);
      else audio.push(a);
      return;
    }
    files.push(a);
  });

  return { photos, videos, files, audio, voice };
};

export const mergeAttachments = (existing, additions) => {
  const seen = new Set(
    (Array.isArray(existing) ? existing : []).map((a) => a?.id).filter(Boolean),
  );
  const merged = [...(Array.isArray(existing) ? existing : [])];
  for (const attachment of Array.isArray(additions) ? additions : []) {
    if (!attachment?.id || seen.has(attachment.id)) continue;
    seen.add(attachment.id);
    merged.unshift(attachment);
  }
  return merged;
};

export const mergeLinks = (existing, additions) => {
  const seen = new Set(
    (Array.isArray(existing) ? existing : []).map((item) => item?.url).filter(Boolean),
  );
  const merged = [...(Array.isArray(existing) ? existing : [])];
  for (const link of Array.isArray(additions) ? additions : []) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    merged.unshift(link);
  }
  return merged.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
};

export const extractLinksFromMessages = (messages) => {
  const seen = new Set();
  const links = [];

  (Array.isArray(messages) ? messages : []).forEach((msg) => {
    const content = msg?.content;
    if (!content || typeof content !== 'string') return;
    const matches = content.match(URL_REGEX);
    if (!matches) return;
    matches.forEach((raw) => {
      const url = raw.replace(/[.,;:!?)]+$/g, '');
      if (!url || seen.has(url)) return;
      seen.add(url);
      links.push({
        url,
        messageId: msg.id,
        createdAt: msg.timestamp || msg.createdAt,
      });
    });
  });

  return links.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
};

export async function fetchMessagesForLinkScan(chatService, chatId, { maxPages = 6, pageSize = 50 } = {}) {
  const all = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < maxPages) {
    const result = await chatService.getMessages(chatId, page, pageSize);
    const batch = Array.isArray(result?.messages) ? result.messages : [];
    all.push(...batch);
    hasMore = Boolean(result?.hasMore);
    page += 1;
    if (batch.length === 0) break;
  }

  return all;
}

export function liveMessagesMediaSignature(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((msg) => {
      const attachmentIds = (msg?.attachments || []).map((a) => a?.id).filter(Boolean).join(',');
      const content = typeof msg?.content === 'string' ? msg.content : '';
      const linkCount = (content.match(URL_REGEX) || []).length;
      return `${msg?.id ?? ''}:${attachmentIds}:${linkCount}:${content.length}`;
    })
    .join('|');
}

export function reconcileAttachments(
  attachments,
  liveMessages,
  { deletedMessageIds = new Set(), deletedAttachmentIds = new Set() } = {},
) {
  const liveMessageIds = new Set(liveMessages.map((msg) => msg?.id).filter(Boolean));
  const liveAttachments = liveMessageAttachments(liveMessages);
  const liveAttachmentIds = new Set(liveAttachments.map((item) => item?.id).filter(Boolean));

  const kept = (Array.isArray(attachments) ? attachments : []).filter((attachment) => {
    const attachmentId = attachment?.id;
    if (attachmentId && deletedAttachmentIds.has(String(attachmentId))) {
      return false;
    }

    const messageId = attachment?.messageId;
    if (messageId && deletedMessageIds.has(String(messageId))) {
      return false;
    }

    if (!messageId) {
      return true;
    }

    if (!liveMessageIds.has(messageId)) {
      return true;
    }

    return attachmentId && liveAttachmentIds.has(attachmentId);
  });

  return mergeAttachments(kept, liveAttachments);
}

export function reconcileLinks(links, liveMessages, { deletedMessageIds = new Set() } = {}) {
  const liveMessageIds = new Set(liveMessages.map((msg) => msg?.id).filter(Boolean));
  const liveLinks = extractLinksFromMessages(liveMessages);

  const kept = (Array.isArray(links) ? links : []).filter((link) => {
    const messageId = link?.messageId;
    if (messageId && deletedMessageIds.has(String(messageId))) {
      return false;
    }
    if (!messageId) {
      return true;
    }
    if (!liveMessageIds.has(messageId)) {
      return true;
    }
    return false;
  });

  return mergeLinks(kept, liveLinks);
}
