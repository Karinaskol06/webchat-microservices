import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildNotificationIdempotencyKey } from './notificationDedup';
import {
  buildPushIdempotencyKey,
  claimNotificationIdempotencyKey,
} from './notificationIdempotencyStore';

describe('notificationIdempotencyStore', () => {
  it('uses the same key for websocket in-app and web push payloads', () => {
    const message = { id: 'msg-99', chatId: 'chat-7' };
    const inAppKey = buildNotificationIdempotencyKey(message, 'chat-7');
    const pushKey = buildPushIdempotencyKey('message-created', {
      messageId: 'msg-99',
      chatId: 'chat-7',
    });
    expect(inAppKey).toBe(pushKey);
    expect(inAppKey).toBe('notification:message-created:msg-99');
  });

  it('allows only one notification per message id', async () => {
    const key = `notification:message-created:dup-${Date.now()}`;
    expect(await claimNotificationIdempotencyKey(key)).toBe(true);
    expect(await claimNotificationIdempotencyKey(key)).toBe(false);
  });

  it('deduplicates back-to-back in-app then push claims for the same message', async () => {
    const key = `notification:message-created:race-${Date.now()}`;
    expect(await claimNotificationIdempotencyKey(key)).toBe(true);
    expect(await claimNotificationIdempotencyKey(key)).toBe(false);
  });

  it('allows separate notifications for different messages in the same chat', async () => {
    const suffix = Date.now();
    const first = buildPushIdempotencyKey('message-created', {
      messageId: `a-${suffix}`,
      chatId: 'same-chat',
    });
    const second = buildPushIdempotencyKey('message-created', {
      messageId: `b-${suffix}`,
      chatId: 'same-chat',
    });
    expect(await claimNotificationIdempotencyKey(first)).toBe(true);
    expect(await claimNotificationIdempotencyKey(second)).toBe(true);
  });
});
