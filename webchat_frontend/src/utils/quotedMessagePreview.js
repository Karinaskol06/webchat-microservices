/** Labels for quoted message previews (Telegram / WhatsApp style). */

/**
 * Composer / optimistic UX: derive preview from full message (`replyToMessage`) when API
 * fields might be incomplete (attachments without server preview text yet).
 */
export function parseQuotedSnippetFromMessage(message) {
  if (!message) return { kind: 'text', subtitle: '' };
  const raw = typeof message.content === 'string' ? message.content.trim() : '';
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  let messageType = String(message.messageType ?? 'TEXT').toUpperCase();
  let content = raw;

  if (attachments.length > 0 && !raw) {
    messageType = 'ATTACHMENT';
    const imgs = attachments.filter((a) => a.isImage || a.fileType === 'IMAGE');
    const vids = attachments.filter(
      (a) => a.fileType === 'VIDEO' || (a.mimeType && String(a.mimeType).startsWith('video/'))
    );
    const single = attachments.length === 1;
    const first = attachments[0];
    if (single && imgs.length === 1) content = 'Image';
    else if (single && vids.length === 1) content = first.filename || 'Video.mp4';
    else if (single) content = first.filename || 'File';
    else content = `${attachments.length} files`;
  } else if (attachments.length > 0 && raw) {
    messageType = 'MIXED';
  }

  return parseQuotedSnippet({
    deleted: false,
    messageType,
    content,
  });
}

export function parseQuotedSnippet(replied) {
  if (!replied) {
    return { kind: 'text', subtitle: '' };
  }
  if (replied.deleted) {
    return { kind: 'deleted', subtitle: 'This message was deleted' };
  }
  const mt = String(replied.messageType ?? 'TEXT').toUpperCase();
  const raw = typeof replied.content === 'string' ? replied.content.trim() : '';
  const isVideoFilename = /\.(mp4|webm|mov|mkv|avi)$/i.test(raw);
  const isMultiFiles = /^\d+\s+files?$/i.test(raw);

  if (mt === 'TEXT') {
    return { kind: 'text', subtitle: raw || 'Message' };
  }
  if (mt === 'ATTACHMENT') {
    if (raw === 'Image' || raw === '') {
      return { kind: 'photo', subtitle: 'Photo' };
    }
    if (isVideoFilename || /^video\b/i.test(raw)) {
      return { kind: 'video', subtitle: raw || 'Video' };
    }
    if (isMultiFiles) {
      return { kind: 'album', subtitle: raw };
    }
    return { kind: 'file', subtitle: raw || 'File' };
  }
  if (mt === 'MIXED') {
    if (raw) {
      return { kind: 'mixed', subtitle: raw };
    }
    return { kind: 'photo', subtitle: 'Photo' };
  }
  return { kind: 'text', subtitle: raw || 'Message' };
}
