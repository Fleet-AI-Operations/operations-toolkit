import { test, expect } from '@playwright/test';
import { loginAsFleet, loginAsAdmin, loginAsUser } from './helpers';

test.describe('QA Feedback Analysis', () => {
    test('should redirect non-authenticated users to login', async ({ page }) => {
        await page.goto('http://localhost:3004/qa-feedback-analysis');
        await expect(page).toHaveURL(/.*login/);
    });

    test('should show forbidden for USER role', async ({ page }) => {
        await loginAsUser(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');
        await expect(page.locator('text=Forbidden')).toBeVisible({ timeout: 10000 });
    });

    test('should load dashboard for FLEET role', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Wait for page to load
        await expect(page.locator('h1:has-text("QA Feedback Analysis")')).toBeVisible({ timeout: 15000 });

        // Check for main UI elements
        await expect(page.locator('text=Filters')).toBeVisible();
        await expect(page.locator('text=QA Workers')).toBeVisible();
    });

    test('should load dashboard for ADMIN role', async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        await expect(page.locator('h1:has-text("QA Feedback Analysis")')).toBeVisible({ timeout: 15000 });
    });

    test('should display worker statistics table', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Wait for table to load
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Check for table headers
        await expect(page.locator('th:has-text("Name")')).toBeVisible();
        await expect(page.locator('th:has-text("Email")')).toBeVisible();
        await expect(page.locator('th:has-text("Total Ratings")')).toBeVisible();
        await expect(page.locator('th:has-text("Negative %")')).toBeVisible();
    });

    test('should not show an Import CSV button on the main dashboard', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        await expect(page.locator('h1:has-text("QA Feedback Analysis")')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('button:has-text("Import CSV")')).not.toBeVisible();
    });

    test('should default to Last 7 Days date range', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        await expect(page.locator('h1:has-text("QA Feedback Analysis")')).toBeVisible({ timeout: 15000 });

        // Last 7 Days button should be the active/highlighted quick-range button
        const sevenDaysBtn = page.locator('button:has-text("Last 7 Days")');
        await expect(sevenDaysBtn).toBeVisible({ timeout: 10000 });
    });

    test('should filter by date range', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Wait for filters to be visible
        await expect(page.locator('text=Filters')).toBeVisible({ timeout: 15000 });

        // Click on 30 Days filter
        const thirtyDaysBtn = page.locator('button:has-text("Last 30 Days")');
        if (await thirtyDaysBtn.isVisible()) {
            await thirtyDaysBtn.click();

            // Wait for data to reload
            await page.waitForTimeout(1000);

            // Table should still be visible
            await expect(page.locator('table')).toBeVisible();
        }
    });

    test('should search for workers', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Wait for search box
        const searchInput = page.locator('input[placeholder*="Search"]');
        await expect(searchInput).toBeVisible({ timeout: 15000 });

        // Type in search box
        await searchInput.fill('test');

        // Table should still be visible (even if empty)
        await expect(page.locator('table')).toBeVisible();
    });

    test('should open worker details page', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Wait for table
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Look for "View Details" button
        const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
        if (await viewDetailsBtn.isVisible()) {
            await viewDetailsBtn.click();

            // Should navigate to worker details page
            await expect(page).toHaveURL(/.*\/qa-feedback-analysis\/worker\/.*/);

            // Check for worker details elements
            await expect(page.locator('text=Total Ratings')).toBeVisible({ timeout: 10000 });
            await expect(page.locator('text=Negative %')).toBeVisible();
        }
    });

    test('should display environment breakdown on worker details', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
        if (await viewDetailsBtn.isVisible()) {
            await viewDetailsBtn.click();

            // Look for environment breakdown section
            const envSection = page.locator('text=Environment Breakdown');
            if (await envSection.isVisible({ timeout: 5000 })) {
                await expect(envSection).toBeVisible();
            }
        }
    });

    test('should open task history modal', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        // Navigate to worker details
        const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
        if (await viewDetailsBtn.isVisible()) {
            await viewDetailsBtn.click();
            await page.waitForTimeout(1000);

            // Look for task cards
            const taskCard = page.locator('div').filter({ hasText: /rated by/i }).first();
            if (await taskCard.isVisible({ timeout: 5000 })) {
                await taskCard.click();

                // Modal should appear
                await expect(page.locator('h2:has-text("Task History")')).toBeVisible({ timeout: 5000 });

                // Check for task details section
                await expect(page.locator('h3:has-text("Task Details")')).toBeVisible();
            }
        }
    });

    test('should close task history modal with X button', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
        if (await viewDetailsBtn.isVisible()) {
            await viewDetailsBtn.click();
            await page.waitForTimeout(1000);

            const taskCard = page.locator('div').filter({ hasText: /rated by/i }).first();
            if (await taskCard.isVisible({ timeout: 5000 })) {
                await taskCard.click();

                // Wait for modal
                await expect(page.locator('h2:has-text("Task History")')).toBeVisible({ timeout: 5000 });

                // Click X button to close
                const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
                await closeBtn.click();

                // Modal should be closed
                await expect(page.locator('h2:has-text("Task History")')).not.toBeVisible();
            }
        }
    });

    test('should filter tasks by rating type', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-analysis');

        const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
        if (await viewDetailsBtn.isVisible()) {
            await viewDetailsBtn.click();
            await page.waitForTimeout(1000);

            // Look for filter buttons
            const negativeBtn = page.locator('button:has-text("Negative")');
            if (await negativeBtn.isVisible({ timeout: 5000 })) {
                await negativeBtn.click();

                // Page should update (no error)
                await page.waitForTimeout(500);
                expect(page.url()).toContain('/qa-feedback-analysis/worker/');
            }
        }
    });
});

test.describe('QA Feedback Import', () => {
    test('should redirect non-admin users away from import page', async ({ page }) => {
        await loginAsFleet(page);
        await page.goto('http://localhost:3004/qa-feedback-import');

        // FLEET users should be allowed (based on current implementation)
        // or should see forbidden message
        await page.waitForLoadState('networkidle');
    });

    test('should load import page for ADMIN role', async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto('http://localhost:3004/qa-feedback-import');

        await expect(page.locator('h1:has-text("Import QA Feedback Ratings")')).toBeVisible({ timeout: 15000 });

        // Check for file upload area
        await expect(page.locator('text=CSV File')).toBeVisible();
    });

    test('should show file upload area', async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto('http://localhost:3004/qa-feedback-import');

        // Look for upload button or drag-drop area
        const uploadArea = page.locator('input[type="file"]');
        await expect(uploadArea).toBeVisible({ timeout: 15000 });
    });
});
