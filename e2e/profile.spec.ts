import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';

test.describe('User Profile & Password Change', () => {
    test.beforeEach(async ({ page }) => {
        // Authenticate as a test user
        await login(page, 'test@example.com', 'testpassword123');
    });

    test('should show user profile dropdown on click', async ({ page }) => {
        await page.click('[data-testid="user-profile-dropdown-trigger"]');
        
        // Check for dropdown items
        await expect(page.locator('[data-testid="change-password-dropdown-item"]')).toBeVisible();
        await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
    });

    test('should open change password modal', async ({ page }) => {
        await page.click('[data-testid="user-profile-dropdown-trigger"]');
        await page.click('[data-testid="change-password-dropdown-item"]');

        // Modal should be visible
        await expect(page.locator('text=Update Password')).toHaveCount(2); // One in h2, one in button
        await expect(page.locator('[data-testid="new-password-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
    });

    test('should validate password match in modal', async ({ page }) => {
        await page.click('[data-testid="user-profile-dropdown-trigger"]');
        await page.click('[data-testid="change-password-dropdown-item"]');

        await page.fill('[data-testid="new-password-input"]', 'password123');
        await page.fill('[data-testid="confirm-password-input"]', 'password456');
        await page.click('[data-testid="update-password-submit"]');

        await expect(page.locator('text=Passwords do not match')).toBeVisible();
    });

    test('should successfully log out from dropdown', async ({ page }) => {
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
    });
});
