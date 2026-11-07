import { expect, test } from '@playwright/test';

test('forced setup guard redirects to /setup', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup/);
});

test('setup page requires a setup code', async ({ page }) => {
  await page.goto('/setup');
  await page.getByRole('button', { name: /complete setup/i }).click();
  await expect(page.getByText(/invalid setup code|setup code/i)).toBeVisible();
});