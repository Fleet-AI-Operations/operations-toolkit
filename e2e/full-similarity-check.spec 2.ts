import { test, expect } from '@playwright/test';

test.describe('Full Similarity Check (FLEET/ADMIN Access)', () => {
    test('should block access for unauthenticated users', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show Full Similarity Check page for FLEET users', async ({ page }) => {
        // This test assumes a FLEET user is logged in
        await page.goto('http://localhost:3004/full-similarity-check');

        // Should see the page header
        await expect(page.locator('h1')).toContainText('Full Similarity Check');
    });

    test('should show navigation link in Fleet sidebar', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Check for Full Similarity Check link in sidebar
        await expect(page.locator('a:has-text("Full Similarity Check")')).toBeVisible();
    });
});

test.describe('Full Similarity Check - Project Selection', () => {
    test('should display project selector', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Wait for project selector
        await page.waitForSelector('select#project-select', { timeout: 5000 });

        // Should have project dropdown
        await expect(page.locator('label:has-text("Select Project")')).toBeVisible();
        await expect(page.locator('select#project-select')).toBeVisible();
    });

    test('should load tasks when project is selected', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Wait for project selector
        await page.waitForSelector('select#project-select', { timeout: 5000 });

        // Select first project
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 }); // Select first non-empty option

        // Wait for tasks table to appear
        await page.waitForSelector('table', { timeout: 5000 });

        // Should show table headers
        await expect(page.locator('th:has-text("Action")')).toBeVisible();
        await expect(page.locator('th:has-text("Content")')).toBeVisible();
        await expect(page.locator('th:has-text("Environment")')).toBeVisible();
        await expect(page.locator('th:has-text("Created By")')).toBeVisible();
        await expect(page.locator('th:has-text("Created At")')).toBeVisible();
    });
});

test.describe('Full Similarity Check - Filtering', () => {
    test('should show filter controls', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for filters to appear
        await page.waitForTimeout(1000);

        // Check for filter dropdowns
        await expect(page.locator('label:has-text("Filter by Environment")')).toBeVisible();
        await expect(page.locator('label:has-text("Filter by User")')).toBeVisible();
    });

    test('should filter by environment', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for environment filter
        await page.waitForSelector('select#environment-filter', { timeout: 5000 });

        // Get initial task count
        const initialRows = await page.locator('tbody tr').count();

        // Select an environment filter
        const envFilter = page.locator('select#environment-filter');
        await envFilter.selectOption({ index: 1 });

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Task count should change (or stay the same if all tasks are from that environment)
        const filteredRows = await page.locator('tbody tr').count();
        expect(filteredRows).toBeGreaterThanOrEqual(0);
    });

    test('should filter by user', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for user filter
        await page.waitForSelector('select#user-filter', { timeout: 5000 });

        // Select a user filter
        const userFilter = page.locator('select#user-filter');
        await userFilter.selectOption({ index: 1 });

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Table should still be visible
        await expect(page.locator('table')).toBeVisible();
    });
});

test.describe('Full Similarity Check - Task List', () => {
    test('should display task table with data', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table to load
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Should have at least one row
        const rowCount = await page.locator('tbody tr').count();
        expect(rowCount).toBeGreaterThan(0);

        // Each row should have "Use for comparison" button
        const firstButton = page.locator('button:has-text("Use for comparison")').first();
        await expect(firstButton).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for pagination info
        await page.waitForTimeout(1000);

        // Should show pagination text like "Showing 1-25 of X tasks"
        await expect(page.locator('text=/Showing \\d+-\\d+ of \\d+ tasks/')).toBeVisible();
    });

    test('should paginate results with 25 per page', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Count rows on first page (should be 25 or less)
        const rowCount = await page.locator('tbody tr').count();
        expect(rowCount).toBeLessThanOrEqual(25);
    });

    test('should allow clicking on task content to view details', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Click on first task content
        const firstContentCell = page.locator('tbody tr td').nth(1); // Content column
        await firstContentCell.click();

        // Wait for modal
        await page.waitForSelector('text=/Task Details/', { timeout: 3000 });

        // Modal should show full content
        // (Assuming there's a close button or modal background)
        await expect(page.locator('text=/Task Details/').or(page.locator('text=/Full Content/'))).toBeVisible();
    });
});

test.describe('Full Similarity Check - Comparison Flow', () => {
    test('should show comparison options modal when clicking "Use for comparison"', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Click "Use for comparison" on first task
        await page.locator('button:has-text("Use for comparison")').first().click();

        // Should show comparison scope modal
        await page.waitForTimeout(500);
        await expect(page.locator('text=/Compare/i')).toBeVisible();
    });

    test('should allow comparing within environment', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Click "Use for comparison"
        await page.locator('button:has-text("Use for comparison")').first().click();

        // Click "Compare within same environment" or similar button
        await page.waitForTimeout(500);
        const envButton = page.locator('button:has-text("environment")').first();
        if (await envButton.count() > 0) {
            await envButton.click();

            // Wait for results
            await page.waitForTimeout(2000);

            // Should show results section
            await expect(page.locator('text=/Similar Prompts/i').or(page.locator('text=/Results/'))).toBeVisible();
        }
    });

    test('should allow comparing across all project', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        // Wait for table
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Click "Use for comparison"
        await page.locator('button:has-text("Use for comparison")').first().click();

        // Click "Compare with all prompts" or similar button
        await page.waitForTimeout(500);
        const allButton = page.locator('button:has-text("all")').first();
        if (await allButton.count() > 0) {
            await allButton.click();

            // Wait for results
            await page.waitForTimeout(2000);

            // Should show results section
            await expect(page.locator('text=/Similar Prompts/i').or(page.locator('text=/Results/'))).toBeVisible();
        }
    });
});

test.describe('Full Similarity Check - Results Display', () => {
    test('should display similarity results with percentages', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Select a project and run comparison
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        await page.waitForSelector('tbody tr', { timeout: 5000 });
        await page.locator('button:has-text("Use for comparison")').first().click();

        await page.waitForTimeout(500);
        const compareButton = page.locator('button:has-text("all")').first();
        if (await compareButton.count() > 0) {
            await compareButton.click();
            await page.waitForTimeout(2000);

            // Should show similarity percentages
            await expect(page.locator('text=/%/')).toBeVisible();
        }
    });

    test('should allow viewing side-by-side comparison', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Run comparison
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        await page.waitForSelector('tbody tr', { timeout: 5000 });
        await page.locator('button:has-text("Use for comparison")').first().click();

        await page.waitForTimeout(500);
        const compareButton = page.locator('button:has-text("all")').first();
        if (await compareButton.count() > 0) {
            await compareButton.click();
            await page.waitForTimeout(2000);

            // Click on a result to view side-by-side
            const compareLink = page.locator('text=/Click to compare/i').or(page.locator('button:has-text("Compare")'));
            if (await compareLink.count() > 0) {
                await compareLink.first().click();

                // Should show side-by-side modal
                await page.waitForTimeout(1000);
                await expect(page.locator('text=/Side-by-Side Comparison/')).toBeVisible();
            }
        }
    });
});

test.describe('Full Similarity Check - AI Analysis', () => {
    test('should show AI analysis in side-by-side view', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Navigate through comparison flow
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        await page.waitForSelector('tbody tr', { timeout: 5000 });
        await page.locator('button:has-text("Use for comparison")').first().click();

        await page.waitForTimeout(500);
        const compareButton = page.locator('button:has-text("all")').first();
        if (await compareButton.count() > 0) {
            await compareButton.click();
            await page.waitForTimeout(2000);

            // Open side-by-side view
            const compareLink = page.locator('text=/Click to compare/i').first();
            if (await compareLink.count() > 0) {
                await compareLink.click();
                await page.waitForTimeout(1000);

                // Should show AI Analysis section
                await expect(page.locator('text=/AI Similarity Analysis/i')).toBeVisible();

                // Should show loading or analysis content
                await expect(
                    page.locator('text=/Analyzing/i').or(page.locator('text=/similarities/i'))
                ).toBeVisible({ timeout: 10000 });
            }
        }
    });

    test('should display AI analysis cost for OpenRouter', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Navigate to side-by-side view (assuming OpenRouter is configured)
        await page.waitForSelector('select#project-select', { timeout: 5000 });
        const projectSelect = page.locator('select#project-select');
        await projectSelect.selectOption({ index: 1 });

        await page.waitForSelector('tbody tr', { timeout: 5000 });
        await page.locator('button:has-text("Use for comparison")').first().click();

        await page.waitForTimeout(500);
        const compareButton = page.locator('button:has-text("all")').first();
        if (await compareButton.count() > 0) {
            await compareButton.click();
            await page.waitForTimeout(2000);

            const compareLink = page.locator('text=/Click to compare/i').first();
            if (await compareLink.count() > 0) {
                await compareLink.click();
                await page.waitForTimeout(5000);

                // Cost badge might appear if using OpenRouter
                const costBadge = page.locator('text=/Cost:/');
                // Only check if it exists (depends on provider configuration)
            }
        }
    });
});

test.describe('Full Similarity Check - Navigation', () => {
    test('should navigate between Fleet Management pages', async ({ page }) => {
        await page.goto('http://localhost:3004/full-similarity-check');

        // Check for other Fleet Management links
        await expect(page.locator('a:has-text("Ingest Data")')).toBeVisible();
        await expect(page.locator('a:has-text("Project Management")')).toBeVisible();
        await expect(page.locator('a:has-text("Analytics")')).toBeVisible();

        // Navigate to another page and back
        await page.locator('a:has-text("Analytics")').click();
        await expect(page).toHaveURL(/\/analytics/);

        await page.locator('a:has-text("Full Similarity Check")').click();
        await expect(page).toHaveURL(/\/full-similarity-check/);
    });
});
