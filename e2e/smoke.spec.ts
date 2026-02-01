import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Task Data/);
});

test('navigation to ingest page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Ingest');
    await expect(page).toHaveURL(/\/ingest/);
    await expect(page.locator('h1')).toContainText(/Ingest/);
});

test('admin console redirect for unauthenticated users', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
});
