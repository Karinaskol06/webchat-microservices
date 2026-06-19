import { describe, expect, it } from 'vitest';
import {
  buildNotificationIdempotencyKey,
  claimIncomingMessage,
  getMessageId,
} from './notificationDedup';

describe('notificationDedup', () => {
  it('deduplicates the same message id from parallel websocket paths', () => {
    const message = { id: 'm-1', chatId: 'c-1', senderId: 2, timestamp: '2026-01-01T00:00:00Z' };
    expect(claimIncomingMessage(message)).toBe(true);
    expect(claimIncomingMessage(message)).toBe(false);
  });

  it('normalizes message ids from alternate payload fields', () => {
    expect(getMessageId({ messageId: 'server-id' })).toBe('server-id');
    expect(getMessageId({ id: 'ws-id' })).toBe('ws-id');
  });

  it('builds a stable idempotency key per message', () => {
    expect(buildNotificationIdempotencyKey({ id: 'm-42' }, 'c-1')).toBe(
      'notification:message-created:m-42',
    );
  });
});
