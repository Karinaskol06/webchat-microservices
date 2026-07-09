import { test, expect } from '@playwright/test';

test.describe('Authentication guard', () => {
  // ensure no leftover auth tokens
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('redirects unauthenticated users from /chat to /login', async ({ page }) => {
    // try to visit protected page
    await page.goto('/chat');
    // should be redirected to login page
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('login page links to register', async ({ page }) => {
    await page.goto('/login');
    // find and click the register link
    await page.getByRole('link', { name: 'Register' }).click();
    // should be redirected to register page
    await expect(page).toHaveURL(/\/register$/);
  });
});
