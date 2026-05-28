import { describe, expect, it } from 'vitest';
import {
  findFirstUnreadIndex,
  isIncomingMessageForUser,
} from './useUnreadMessageSeparator';

describe('useUnreadMessageSeparator helpers', () => {
  it('treats current user messages as outgoing', () => {
    expect(isIncomingMessageForUser({ senderId: 9 }, 9)).toBe(false);
    expect(isIncomingMessageForUser({ sender: { id: 12 } }, 9)).toBe(true);
  });

  it('skips outgoing messages when using unread-count fallback', () => {
    const messages = [
      { id: 'm1', senderId: 2, timestamp: '2026-05-26T10:00:00.000Z' },
      { id: 'm2', senderId: 9, timestamp: '2026-05-26T10:01:00.000Z' },
    ];

    expect(findFirstUnreadIndex(messages, null, 1, 9)).toBe(0);
  });

  it('only shows the separator for incoming messages after the read edge', () => {
    const messages = [
      { id: 'm1', senderId: 9, timestamp: '2026-05-26T10:01:00.000Z' },
      { id: 'm2', senderId: 4, timestamp: '2026-05-26T10:02:00.000Z' },
      { id: 'm3', senderId: 9, timestamp: '2026-05-26T10:03:00.000Z' },
    ];

    expect(findFirstUnreadIndex(messages, Date.parse('2026-05-26T10:00:30.000Z'), 0, 9)).toBe(1);
    expect(findFirstUnreadIndex(messages, Date.parse('2026-05-26T10:02:30.000Z'), 0, 9)).toBe(null);
  });
});
