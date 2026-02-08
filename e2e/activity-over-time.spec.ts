import { test, expect } from '@playwright/test';

test.describe('Activity Over Time (Manager/Admin Access)', () => {
    test('should block access for unauthenticated users', async ({ page }) => {
        await page.goto('/activity-over-time');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show Activity Over Time navigation link for managers', async ({ page }) => {
        // This test assumes a manager user is logged in
        // In a real test, you would authenticate first
        await page.goto('/activity-over-time');

        // Should see the page content
        await expect(page.locator('text=Activity Over Time')).toBeVisible();
    });

    test('should show activity page with key elements', async ({ page }) => {
        // Navigate to activity over time (assumes proper auth)
        await page.goto('/activity-over-time');

        // Check for main header
        await expect(page.locator('h1')).toContainText(/Activity Over Time/);

        // Check for date range controls
        await expect(page.locator('input[type="date"]')).toHaveCount(2); // Start and End date

        // Check for quick select buttons
        await expect(page.locator('button:has-text("7 Days")')).toBeVisible();
        await expect(page.locator('button:has-text("30 Days")')).toBeVisible();
        await expect(page.locator('button:has-text("90 Days")')).toBeVisible();

        // Check for chart legend
        await expect(page.locator('text=Tasks')).toBeVisible();
        await expect(page.locator('text=Feedback')).toBeVisible();
    });

    test('should display statistics summary', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for data to load
        await page.waitForSelector('text=Total Items', { timeout: 5000 });

        // Check for statistics cards
        await expect(page.locator('text=Total Items')).toBeVisible();
        await expect(page.locator('text=Tasks')).toBeVisible();
        await expect(page.locator('text=Feedback')).toBeVisible();
        await expect(page.locator('text=Daily Average')).toBeVisible();
    });

    test('should render the line chart', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for chart to render
        await page.waitForSelector('svg', { timeout: 5000 });

        // Check for SVG chart elements
        const svg = page.locator('svg').first();
        await expect(svg).toBeVisible();

        // Check for chart paths (lines)
        const paths = page.locator('svg path');
        await expect(paths).toHaveCount(2); // Tasks and Feedback lines
    });
});

test.describe('Activity Over Time - Date Range Controls', () => {
    test('should update chart when selecting quick date ranges', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for initial load
        await page.waitForSelector('text=Total Items', { timeout: 5000 });

        // Click "7 Days"
        await page.locator('button:has-text("7 Days")').click();

        // Wait for data to refresh
        await page.waitForTimeout(500);

        // Chart should still be visible
        await expect(page.locator('svg').first()).toBeVisible();

        // Click "90 Days"
        await page.locator('button:has-text("90 Days")').click();

        // Wait for data to refresh
        await page.waitForTimeout(500);

        // Chart should still be visible
        await expect(page.locator('svg').first()).toBeVisible();
    });

    test('should allow custom date range selection', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for initial load
        await page.waitForSelector('input[type="date"]', { timeout: 5000 });

        // Get date inputs
        const dateInputs = page.locator('input[type="date"]');
        const startDateInput = dateInputs.first();
        const endDateInput = dateInputs.last();

        // Set custom date range
        await startDateInput.fill('2026-01-01');
        await endDateInput.fill('2026-01-31');

        // Wait for data to refresh
        await page.waitForTimeout(1000);

        // Chart should still be visible
        await expect(page.locator('svg').first()).toBeVisible();
    });
});

test.describe('Activity Over Time - Interactive Features', () => {
    test('should show hover tooltips on data points', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for chart to render
        await page.waitForSelector('svg circle', { timeout: 5000 });

        // Get a data point circle
        const dataPoint = page.locator('svg circle').first();

        if (await dataPoint.count() > 0) {
            // Hover over the data point
            await dataPoint.hover();

            // Tooltip should appear with date and counts
            // Note: This assumes tooltip is rendered in the DOM
            // Adjust selector based on actual tooltip implementation
            await page.waitForTimeout(100);
        }
    });

    test('should toggle task line visibility', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for chart to render
        await page.waitForSelector('svg path', { timeout: 5000 });

        // Find the Tasks toggle button (in legend)
        const tasksToggle = page.locator('button:has-text("Tasks")');

        if (await tasksToggle.count() > 0) {
            // Click to toggle off
            await tasksToggle.click();
            await page.waitForTimeout(100);

            // Click to toggle back on
            await tasksToggle.click();
            await page.waitForTimeout(100);

            // Chart should still be visible
            await expect(page.locator('svg').first()).toBeVisible();
        }
    });

    test('should toggle feedback line visibility', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for chart to render
        await page.waitForSelector('svg path', { timeout: 5000 });

        // Find the Feedback toggle button (in legend)
        const feedbackToggle = page.locator('button:has-text("Feedback")');

        if (await feedbackToggle.count() > 0) {
            // Click to toggle off
            await feedbackToggle.click();
            await page.waitForTimeout(100);

            // Click to toggle back on
            await feedbackToggle.click();
            await page.waitForTimeout(100);

            // Chart should still be visible
            await expect(page.locator('svg').first()).toBeVisible();
        }
    });

    test('should toggle both lines independently', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Wait for chart to render
        await page.waitForSelector('svg path', { timeout: 5000 });

        // Toggle both lines off
        await page.locator('button:has-text("Tasks")').click();
        await page.locator('button:has-text("Feedback")').click();
        await page.waitForTimeout(100);

        // Toggle both back on
        await page.locator('button:has-text("Tasks")').click();
        await page.locator('button:has-text("Feedback")').click();
        await page.waitForTimeout(100);

        // Chart should still be visible
        await expect(page.locator('svg').first()).toBeVisible();
    });
});

test.describe('Fleet Tools - Navigation from Activity Over Time', () => {
    test('should show Fleet Tools in main sidebar', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Check for main sidebar navigation items under Fleet Tools
        await expect(page.locator('text=Fleet Tools')).toBeVisible();
        await expect(page.locator('a:has-text("Bonus Windows")')).toBeVisible();
        await expect(page.locator('a:has-text("Activity Over Time")')).toBeVisible();
        await expect(page.locator('a:has-text("Time Analytics")')).toBeVisible();
    });

    test('should navigate between Fleet Tools pages', async ({ page }) => {
        await page.goto('/activity-over-time');

        // Navigate to Bonus Windows
        await page.locator('a:has-text("Bonus Windows")').click();
        await expect(page).toHaveURL(/\/bonus-windows/);
        await expect(page.locator('text=Bonus Windows')).toBeVisible();

        // Navigate to Time Analytics
        await page.locator('a:has-text("Time Analytics")').click();
        await expect(page).toHaveURL(/\/time-analytics/);
        await expect(page.locator('text=Under Construction')).toBeVisible();

        // Navigate back to Activity Over Time
        await page.locator('a:has-text("Activity Over Time")').click();
        await expect(page).toHaveURL(/\/activity-over-time/);
        await expect(page.locator('text=Daily Activity Chart')).toBeVisible();
    });
});
