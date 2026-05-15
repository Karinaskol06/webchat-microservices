const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

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
