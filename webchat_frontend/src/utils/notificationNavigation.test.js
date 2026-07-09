import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  normalizeNavigationDetail,
  publishNotificationNavigation,
  subscribeNotificationNavigation,
} from './notificationNavigation';

describe('notificationNavigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes navigation detail', () => {
    expect(
      normalizeNavigationDetail({
        chatId: 'abc',
        messageId: 'm1',
        focusComposer: true,
        markRead: false,
      }),
    ).toEqual({
      chatId: 'abc',
      messageId: 'm1',
      focusComposer: true,
      markRead: false,
    });
  });

  it('publishes to subscribers immediately', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeNotificationNavigation(handler);
    publishNotificationNavigation({ chatId: 'room-1', messageId: '42' });
    expect(handler).toHaveBeenCalledWith({
      chatId: 'room-1',
      messageId: '42',
      focusComposer: false,
      markRead: false,
    });
    unsubscribe();
  });
});
