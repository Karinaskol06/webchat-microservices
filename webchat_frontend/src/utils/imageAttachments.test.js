import { describe, expect, it } from 'vitest';
import { collectChatImageAttachments, isImageAttachment } from './imageAttachments';

describe('isImageAttachment', () => {
  it('detects image attachments', () => {
    expect(isImageAttachment({ id: 1, isImage: true })).toBe(true);
    expect(isImageAttachment({ id: 2, fileType: 'IMAGE' })).toBe(true);
    expect(isImageAttachment({ id: 3, mimeType: 'image/png' })).toBe(true);
    expect(isImageAttachment({ id: 4, fileType: 'DOCUMENT' })).toBe(false);
    expect(isImageAttachment(null)).toBe(false);
  });
});

describe('collectChatImageAttachments', () => {
  it('collects unique images in message order', () => {
    const messages = [
      { attachments: [{ id: 10, isImage: true }, { id: 11, fileType: 'DOCUMENT' }] },
      { attachments: [{ id: 12, fileType: 'IMAGE' }, { id: 10, isImage: true }] },
    ];

    expect(collectChatImageAttachments(messages).map((item) => item.id)).toEqual([10, 12]);
  });
});
