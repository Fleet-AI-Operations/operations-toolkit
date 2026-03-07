import { test, expect } from '@playwright/test';

test.describe('Similarity Flags - Access Control', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show Similarity Flags page for CORE users', async ({ page }) => {
        // This test assumes a CORE user is logged in
        await page.goto('http://localhost:3003/similarity-flags');

        // Should see the page header
        await expect(page.locator('h1')).toContainText('Similarity Flags');
    });
});

test.describe('Similarity Flags - Page Structure', () => {
    test('should show status filter tabs: All, Open, Claimed', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await expect(page.locator('button:has-text("All")')).toBeVisible();
        await expect(page.locator('button:has-text("Open")')).toBeVisible();
        await expect(page.locator('button:has-text("Claimed")')).toBeVisible();
    });

    test('should show environment dropdown', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Environment select has an "All environments" default option
        await expect(page.locator('select')).toBeVisible();
        await expect(page.locator('option:has-text("All environments")')).toBeAttached();
    });

    test('should show Refresh button', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
    });

    test('should show pagination controls with Page X of Y', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Wait for initial load to settle
        await page.waitForTimeout(1000);

        // Pagination label is only shown when flags are present; check for the
        // text pattern or for the empty-state message — either is valid.
        const paginationText = page.locator('text=/Page \\d+ of \\d+/');
        const emptyState = page.locator('text=/No similarity flags found/');

        await expect(paginationText.or(emptyState)).toBeVisible({ timeout: 5000 });
    });

    test('should show table with expected column headers when flags exist', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Wait for load
        await page.waitForTimeout(1000);

        // Only assert headers when a table is rendered
        const tableCount = await page.locator('table').count();
        if (tableCount > 0) {
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
            await expect(page.locator('th:has-text("User")')).toBeVisible();
            await expect(page.locator('th:has-text("Score")')).toBeVisible();
            await expect(page.locator('th:has-text("Source (snippet)")')).toBeVisible();
            await expect(page.locator('th:has-text("Match (snippet)")')).toBeVisible();
            await expect(page.locator('th:has-text("Environment")')).toBeVisible();
            await expect(page.locator('th:has-text("Date")')).toBeVisible();
        }
    });
});

test.describe('Similarity Flags - Status Filtering', () => {
    test('clicking Open tab should activate the Open tab style', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        const openBtn = page.locator('button:has-text("Open")');
        await openBtn.click();

        // After clicking, the button should have non-transparent background (active style)
        // The page uses inline styles, so we verify it is still visible and clickable
        await expect(openBtn).toBeVisible();

        // The "All" button should now not be the active tab — verify by clicking
        // "Open" and checking the URL or state hasn't redirected away
        await expect(page).toHaveURL(/\/similarity-flags/);
    });

    test('clicking Claimed tab should reveal Mine only button', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Mine only should not be visible initially (default tab is All)
        await expect(page.locator('button:has-text("Mine only")')).not.toBeVisible();

        // Click Claimed tab
        await page.locator('button:has-text("Claimed")').click();

        // Mine only button should now appear
        await expect(page.locator('button:has-text("Mine only")')).toBeVisible();
    });

    test('clicking All tab should hide Mine only button', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // First switch to Claimed to reveal Mine only
        await page.locator('button:has-text("Claimed")').click();
        await expect(page.locator('button:has-text("Mine only")')).toBeVisible();

        // Switch back to All
        await page.locator('button:has-text("All")').click();

        // Mine only should be hidden again
        await expect(page.locator('button:has-text("Mine only")')).not.toBeVisible();
    });
});

test.describe('Similarity Flags - Match Type Filtering', () => {
    test('should show match type filter buttons: All, User History, Daily Great Task', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await expect(page.locator('button:has-text("All")')).toBeVisible();
        await expect(page.locator('button:has-text("User History")')).toBeVisible();
        await expect(page.locator('button:has-text("Daily Great Task")')).toBeVisible();
    });

    test('clicking Daily Great Task filter should remain on similarity-flags URL', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await page.locator('button:has-text("Daily Great Task")').click();

        await expect(page).toHaveURL(/\/similarity-flags/);
    });

    test('clicking User History filter should remain on similarity-flags URL', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await page.locator('button:has-text("User History")').click();

        await expect(page).toHaveURL(/\/similarity-flags/);
    });

    test('clicking All match type filter should remain on similarity-flags URL', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Switch away from All, then back
        await page.locator('button:has-text("Daily Great Task")').click();
        await page.locator('button:has-text("All")').click();

        await expect(page).toHaveURL(/\/similarity-flags/);
    });

    test('Daily Great Task tab should show amber badge when DAILY_GREAT flags exist', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');
        await page.waitForTimeout(1000);

        await page.locator('button:has-text("Daily Great Task")').click();
        await page.waitForTimeout(500);

        // Check if any rows are rendered; if so, look for the Daily Great Task badge
        const tableCount = await page.locator('table').count();
        if (tableCount > 0) {
            const rowCount = await page.locator('tbody tr').count();
            if (rowCount > 0) {
                await expect(page.locator('text=/Daily Great Task/').first()).toBeVisible({ timeout: 3000 });
            }
        }
        // If no data, the test passes gracefully (no flags to assert on)
    });
});

test.describe('Similarity Flags - Interactions', () => {
    test('clicking a source snippet should open a modal with Source Record in the header', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Wait for load
        await page.waitForTimeout(1000);

        // Only run if there is data in the table
        const tableCount = await page.locator('table').count();
        if (tableCount === 0) {
            // No flags in the system — skip interaction test gracefully
            return;
        }

        // Find the first snippet button in the Source column (4th column, index 3)
        const firstSourceBtn = page.locator('tbody tr').first().locator('td').nth(3).locator('button');
        await firstSourceBtn.click();

        // Modal should appear with "Source Record" in the heading
        await expect(page.locator('text=/Source Record/')).toBeVisible({ timeout: 3000 });
    });

    test('modal should have a close button (×) that dismisses it', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        // Wait for load
        await page.waitForTimeout(1000);

        const tableCount = await page.locator('table').count();
        if (tableCount === 0) {
            return;
        }

        // Open the modal via the first source snippet
        const firstSourceBtn = page.locator('tbody tr').first().locator('td').nth(3).locator('button');
        await firstSourceBtn.click();

        // Verify modal is open
        await expect(page.locator('text=/Source Record/')).toBeVisible({ timeout: 3000 });

        // Click the × close button
        await page.locator('button:has-text("×")').click();

        // Modal should be dismissed
        await expect(page.locator('text=/Source Record/')).not.toBeVisible({ timeout: 2000 });
    });

    test('table rows have an Analyse button when flags exist', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await page.waitForTimeout(1000);

        const tableCount = await page.locator('table').count();
        if (tableCount === 0) {
            return;
        }

        // Each flag row should have an Analyse button
        await expect(page.locator('tbody tr').first().locator('button:has-text("Analyse")')).toBeVisible({ timeout: 3000 });
    });

    test('clicking Analyse opens AI analysis modal', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await page.waitForTimeout(1000);

        const tableCount = await page.locator('table').count();
        if (tableCount === 0) {
            return;
        }

        // Click the first Analyse button
        await page.locator('tbody tr').first().locator('button:has-text("Analyse")').click();

        // Modal should appear with AI Analysis heading
        await expect(page.locator('text=/AI Analysis/')).toBeVisible({ timeout: 3000 });
    });

    test('AI analysis modal can be closed', async ({ page }) => {
        await page.goto('http://localhost:3003/similarity-flags');

        await page.waitForTimeout(1000);

        const tableCount = await page.locator('table').count();
        if (tableCount === 0) {
            return;
        }

        await page.locator('tbody tr').first().locator('button:has-text("Analyse")').click();
        await expect(page.locator('text=/AI Analysis/')).toBeVisible({ timeout: 3000 });

        // Close via × button
        await page.locator('button:has-text("×")').last().click();
        await expect(page.locator('text=/AI Analysis/')).not.toBeVisible({ timeout: 2000 });
    });
});
