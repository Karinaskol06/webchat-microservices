import { test, expect } from '@playwright/test';

test.describe('Login flow (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });

    // request interception to mock API endpoints
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          username: 'e2euser',
        }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          username: 'e2euser',
          email: 'e2e@example.com',
        }),
      });
    });

    await page.route('**/api/auth/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          username: 'e2euser',
          email: 'e2e@example.com',
        }),
      });
    });
  });

  test('successful login navigates to chat', async ({ page }) => {
    await page.goto('/login');
    // fill in the login form
    await page.getByLabel('Username or email').fill('e2euser');
    await page.getByPlaceholder('Password').fill('secret');
    await page.getByRole('button', { name: 'Login' }).click();
    // should be redirected to chat page (protected)
    await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 });
  });

  test('shows error when login API fails', async ({ page }) => {
    // override the login API to return 401
    await page.unroute('**/api/auth/login');
    await page.route('**/api/auth/login', async (route) => {
      // return 401 Unauthorized
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });
  
    await page.goto('/login');
    // fill in the login form
    await page.getByLabel('Username or email').fill('bad');
    await page.getByPlaceholder('Password').fill('bad');
    await page.getByRole('button', { name: 'Login' }).click();
    // should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    // should stay on login page
    await expect(page).toHaveURL(/\/login$/);
  });
});
