import { describe, expect, it } from 'vitest';
import {
  clearSharedMediaDeletionState,
  getSharedMediaDeletionState,
  recordSharedMediaAttachmentDeleted,
  recordSharedMediaMessageDeleted,
  reconcileAttachments,
  reconcileLinks,
} from './sharedMedia';

describe('reconcileAttachments', () => {
  it('removes attachments for deleted messages', () => {
    const attachments = [
      { id: 'a1', messageId: 'm1' },
      { id: 'a2', messageId: 'm2' },
    ];

    const result = reconcileAttachments(attachments, [], {
      deletedMessageIds: new Set(['m1']),
    });

    expect(result).toEqual([{ id: 'a2', messageId: 'm2' }]);
  });

  it('drops attachments removed from a loaded message', () => {
    const attachments = [{ id: 'a1', messageId: 'm1' }];
    const liveMessages = [{ id: 'm1', attachments: [] }];

    const result = reconcileAttachments(attachments, liveMessages);

    expect(result).toEqual([]);
  });

  it('keeps historical attachments outside the loaded message window', () => {
    const attachments = [{ id: 'a1', messageId: 'old-message' }];
    const liveMessages = [{ id: 'm1', attachments: [{ id: 'a2' }] }];

    const result = reconcileAttachments(attachments, liveMessages);

    expect(result.map((item) => item.id)).toEqual(['a2', 'a1']);
  });
});

describe('reconcileLinks', () => {
  it('removes links for deleted messages', () => {
    const links = [
      { url: 'https://example.com', messageId: 'm1' },
      { url: 'https://other.com', messageId: 'm2' },
    ];

    const result = reconcileLinks(links, [], {
      deletedMessageIds: new Set(['m1']),
    });

    expect(result).toEqual([{ url: 'https://other.com', messageId: 'm2' }]);
  });

  it('drops links removed from edited message content', () => {
    const links = [{ url: 'https://example.com', messageId: 'm1' }];
    const liveMessages = [{ id: 'm1', content: 'no links here' }];

    const result = reconcileLinks(links, liveMessages);

    expect(result).toEqual([]);
  });
});

describe('shared media deletion tracking', () => {
  it('records deleted messages and attachments per room', () => {
    clearSharedMediaDeletionState('room-1');
    recordSharedMediaMessageDeleted('room-1', 'm1');
    recordSharedMediaAttachmentDeleted('room-1', 'm2', 'a1');

    expect(getSharedMediaDeletionState('room-1')).toEqual({
      deletedMessageIds: new Set(['m1']),
      deletedAttachmentIds: new Set(['a1']),
    });

    clearSharedMediaDeletionState('room-1');
    expect(getSharedMediaDeletionState('room-1')).toEqual({
      deletedMessageIds: new Set(),
      deletedAttachmentIds: new Set(),
    });
  });
});
