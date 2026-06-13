export function isImageAttachment(attachment) {
  if (!attachment?.id) return false;
  return Boolean(
    attachment.isImage ||
      attachment.fileType === 'IMAGE' ||
      attachment.mimeType?.startsWith('image/'),
  );
}

export function collectChatImageAttachments(messages) {
  const items = [];
  const seen = new Set();

  for (const message of messages || []) {
    for (const attachment of message.attachments || []) {
      if (isImageAttachment(attachment) && !seen.has(attachment.id)) {
        seen.add(attachment.id);
        items.push(attachment);
      }
    }
  }

  return items;
}
