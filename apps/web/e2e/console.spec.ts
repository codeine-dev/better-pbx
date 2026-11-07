import { expect, test } from '@playwright/test';

test('setup page renders console shell', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: /setup/i })).toBeVisible();
});
