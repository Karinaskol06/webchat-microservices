import chatService from '../services/chatService';

export async function openAttachment(attachment, { download = false } = {}) {
  const blob = await chatService.getAttachmentBlob(attachment.id, { download });
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = attachment?.filename || 'attachment';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
