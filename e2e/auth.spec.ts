import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show login form', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('form')).toBeVisible();
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toContainText(/Sign In/);
    });
});

test.describe('Authorization & Role Redirects', () => {
    test('should show reset password page', async ({ page }) => {
        // This validates the page exists and is accessible
        await page.goto('/auth/reset-password');
        await expect(page.locator('h1')).toContainText(/Reset Your Password/);
        await expect(page.locator('button[type="submit"]')).toContainText(/Update Password/);
    });
});
