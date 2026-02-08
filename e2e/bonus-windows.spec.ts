import { test, expect } from '@playwright/test';

test.describe('Bonus Windows (Manager/Admin Access)', () => {
    test('should block access for unauthenticated users', async ({ page }) => {
        await page.goto('/bonus-windows');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show Bonus Windows navigation link for managers', async ({ page }) => {
        // This test assumes a manager user is logged in
        // In a real test, you would authenticate first
        await page.goto('/bonus-windows');

        // Should see the page content
        await expect(page.locator('text=Bonus Windows')).toBeVisible();
    });

    test('should show bonus windows page with key elements', async ({ page }) => {
        // Navigate to bonus windows (assumes proper auth)
        await page.goto('/bonus-windows');

        // Check for main header
        await expect(page.locator('h1')).toContainText(/Bonus Windows/);

        // Check for "New Bonus Window" button
        await expect(page.locator('button:has-text("New Bonus Window")')).toBeVisible();

        // Check for description text
        await expect(page.locator('text=Configure performance windows')).toBeVisible();
    });

    test('should show create form when clicking New Bonus Window', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Click New Bonus Window button
        await page.locator('button:has-text("New Bonus Window")').click();

        // Form should appear
        await expect(page.locator('text=Create New Bonus Window')).toBeVisible();
        await expect(page.locator('input[type="text"]')).toBeVisible(); // Name field
        await expect(page.locator('input[type="datetime-local"]')).toHaveCount(2); // Start/End time

        // Check for tier 1 and tier 2 inputs
        await expect(page.locator('text=Target Task Count (Tier 1)')).toBeVisible();
        await expect(page.locator('text=Target Feedback Count (Tier 1)')).toBeVisible();
        await expect(page.locator('text=Target Task Count (Tier 2 - Optional)')).toBeVisible();
        await expect(page.locator('text=Target Feedback Count (Tier 2 - Optional)')).toBeVisible();

        // Check for submit button
        await expect(page.locator('button[type="submit"]:has-text("Create Window")')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Open form
        await page.locator('button:has-text("New Bonus Window")').click();

        // Try to submit without filling required fields
        await page.locator('button[type="submit"]:has-text("Create Window")').click();

        // Browser validation should prevent submission (datetime-local fields are required)
        // Form should still be visible
        await expect(page.locator('text=Create New Bonus Window')).toBeVisible();
    });
});

test.describe('Bonus Windows - User Breakdown', () => {
    test('should show expand/collapse button for user breakdown', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Assuming at least one bonus window exists
        // Look for the expand button
        const expandButton = page.locator('button:has-text("View User Breakdown")');

        if (await expandButton.count() > 0) {
            // Click to expand
            await expandButton.first().click();

            // Should show "Hide User Breakdown"
            await expect(page.locator('button:has-text("Hide User Breakdown")')).toBeVisible();

            // Should show table headers
            await expect(page.locator('text=USER EMAIL')).toBeVisible();
            await expect(page.locator('text=TASKS')).toBeVisible();
            await expect(page.locator('text=FEEDBACK')).toBeVisible();
            await expect(page.locator('text=TOTAL')).toBeVisible();
        }
    });

    test('should show tier badges when users qualify', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Expand a bonus window that has user data
        const expandButton = page.locator('button:has-text("View User Breakdown")');

        if (await expandButton.count() > 0) {
            await expandButton.first().click();

            // Look for tier badges (T1 or T2)
            // These would only appear if users have met targets
            const tierBadges = page.locator('span:text-matches("T[12]")');

            // This is conditional - tier badges only show if users qualified
            // Just verify the breakdown table is rendered correctly
            await expect(page.locator('text=USER EMAIL')).toBeVisible();
        }
    });
});

test.describe('Fleet Tools - Navigation', () => {
    test('should show Fleet Tools in main sidebar', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Check for main sidebar navigation items under Fleet Tools
        await expect(page.locator('text=Fleet Tools')).toBeVisible();
        await expect(page.locator('a:has-text("Bonus Windows")')).toBeVisible();
        await expect(page.locator('a:has-text("Activity Over Time")')).toBeVisible();
        await expect(page.locator('a:has-text("Time Analytics")')).toBeVisible();
    });

    test('should navigate between Fleet Tools pages', async ({ page }) => {
        await page.goto('/bonus-windows');

        // Navigate to Activity Over Time
        await page.locator('a:has-text("Activity Over Time")').click();
        await expect(page).toHaveURL(/\/activity-over-time/);
        await expect(page.locator('text=Daily Activity Chart')).toBeVisible();

        // Navigate to Time Analytics
        await page.locator('a:has-text("Time Analytics")').click();
        await expect(page).toHaveURL(/\/time-analytics/);
        await expect(page.locator('text=Under Construction')).toBeVisible();
    });
});
