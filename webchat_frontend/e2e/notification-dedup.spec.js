import { test, expect } from '@playwright/test';

test.describe('notification deduplication', () => {
  test('browser idempotency store blocks duplicate websocket + push keys', async ({ page }) => {
    await page.goto('/login');

    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/notificationIdempotencyStore.js');
      const key = `notification:message-created:e2e-${Date.now()}`;
      const first = await mod.claimNotificationIdempotencyKey(key);
      const second = await mod.claimNotificationIdempotencyKey(key);
      return { first, second, key };
    });

    expect(result.first).toBe(true);
    expect(result.second).toBe(false);
  });
});
