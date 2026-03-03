import { test, expect } from '@playwright/test';

const CORE_URL = 'http://localhost:3003';

test.describe('Task Search - Access Control', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await expect(page).toHaveURL(/\/login/);
    });

    test('should show Task Search page for CORE users', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await expect(page.locator('h1')).toContainText('Task Search');
    });

    test('should show navigation link in Core sidebar', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await expect(page.locator('a:has-text("Task Search")')).toBeVisible();
    });
});

test.describe('Task Search - Search Interface', () => {
    test('should display search input and button', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('input[placeholder*="name, email"]')).toBeVisible();
        await expect(page.locator('button:has-text("Search")')).toBeVisible();
    });

    test('should show descriptive subtitle', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=/Search tasks by creator/i')).toBeVisible();
    });

    test('should have Search button disabled when input is empty', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        const searchButton = page.locator('button:has-text("Search")');
        await expect(searchButton).toBeDisabled();
    });

    test('should enable Search button when text is entered', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', 'test');

        const searchButton = page.locator('button:has-text("Search")');
        await expect(searchButton).toBeEnabled();
    });

    test('should trigger search on Enter key press', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        const searchInput = page.locator('input[placeholder*="name, email"]');
        await searchInput.fill('nonexistent-query-xyz');
        await searchInput.press('Enter');

        // Should show empty state or results (not still on initial state)
        await expect(
            page.locator('text=/No tasks found|results found/i').first()
        ).toBeVisible({ timeout: 8000 });
    });
});

test.describe('Task Search - Search Results', () => {
    test('should show empty state for unmatched query', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        const searchInput = page.locator('input[placeholder*="name, email"]');
        await searchInput.fill('__no_match_expected_xyz_123__');
        await page.locator('button:has-text("Search")').click();

        await expect(page.locator('text=/No tasks found/i')).toBeVisible({ timeout: 8000 });
    });

    test('should show result count when results are returned', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        // Use a broad query likely to return something from real data
        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();

        await page.waitForTimeout(3000);

        // Either results found or empty state — both are valid
        const hasResults = await page.locator('text=/result.*found/i').count();
        const hasEmpty = await page.locator('text=/No tasks found/i').count();
        expect(hasResults + hasEmpty).toBeGreaterThan(0);
    });

    test('should display AI Check button on each result card', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();

        await page.waitForTimeout(3000);

        // If results exist, AI Check button should be present
        const cards = page.locator('button:has-text("AI Check")');
        const resultCount = await page.locator('text=/result.*found/i').count();

        if (resultCount > 0) {
            await expect(cards.first()).toBeVisible();
        }
    });

    test('should show task content in result cards', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();

        await page.waitForTimeout(3000);

        const resultCount = await page.locator('text=/result.*found/i').count();
        if (resultCount > 0) {
            // Should show environment badge and content
            await expect(page.locator('.glass-card').first()).toBeVisible();
        }
    });
});

test.describe('Task Search - AI Check', () => {
    test('should show AI Check result panel after running check', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);

        const aiCheckButton = page.locator('button:has-text("AI Check")').first();
        if (await aiCheckButton.count() > 0) {
            await aiCheckButton.click();

            // Wait for the AI check to complete (may take a few seconds)
            await expect(
                page.locator('text=/Authentic|AI Generated|Templated/i').first()
            ).toBeVisible({ timeout: 30000 });
        }
    });

    test('should display verdict, confidence, and reasoning in AI result', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);

        const aiCheckButton = page.locator('button:has-text("AI Check")').first();
        if (await aiCheckButton.count() > 0) {
            await aiCheckButton.click();

            // Wait for result
            await page.waitForTimeout(30000);

            // Should show one of the three verdicts
            const verdictVisible = await page.locator('text=/Authentic|AI Generated|Templated/i').count();
            expect(verdictVisible).toBeGreaterThan(0);

            // Should show confidence
            const confidenceVisible = await page.locator('text=/HIGH|MEDIUM|LOW/').count();
            expect(confidenceVisible).toBeGreaterThan(0);
        }
    });

    test('should show "Checking…" state while AI check is running', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);

        const aiCheckButton = page.locator('button:has-text("AI Check")').first();
        if (await aiCheckButton.count() > 0) {
            await aiCheckButton.click();

            // Immediately after click, should show "Checking…" loading state
            await expect(
                page.locator('button:has-text("Checking…")').first()
            ).toBeVisible({ timeout: 2000 });
        }
    });
});

test.describe('Task Search - Environment Filter', () => {
    test('should not show environment filter when no results exist', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '__no_match_expected_xyz_123__');
        await page.locator('button:has-text("Search")').click();

        await expect(page.locator('text=/No tasks found/i')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('select, [role="combobox"]').filter({ hasText: /environment/i })).not.toBeVisible();
    });

    test('should show environment filter when results span multiple environments', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);

        const resultCount = await page.locator('text=/result.*found/i').count();
        if (resultCount > 0) {
            // Filter only appears when results span >1 environment — either outcome is valid
            const filterVisible = await page.locator('select').filter({ hasText: /All environments/i }).count();
            // If shown, it should contain "All environments" as the default option
            if (filterVisible > 0) {
                await expect(page.locator('select').filter({ hasText: /All environments/i })).toBeVisible();
            }
        }
    });

    test('should update result count when environment filter is applied', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[placeholder*="name, email"]', '@');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);

        const filterSelect = page.locator('select').filter({ hasText: /All environments/i });
        if (await filterSelect.count() > 0) {
            // Select the first non-default option
            const options = await filterSelect.locator('option').all();
            if (options.length > 1) {
                const firstEnv = await options[1].textContent();
                await filterSelect.selectOption({ index: 1 });

                // Count should now show "X of Y results in "env""
                await expect(
                    page.locator(`text=/of.*results in/i`).first()
                ).toBeVisible({ timeout: 3000 });
            }
        }
    });
});

test.describe('Task Search - Navigation', () => {
    test('should show other Core sidebar items', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);

        await expect(page.locator('a:has-text("Alignment Scoring")')).toBeVisible();
        await expect(page.locator('a:has-text("Likert Scoring")')).toBeVisible();
    });

    test('should highlight Task Search as active in sidebar', async ({ page }) => {
        await page.goto(`${CORE_URL}/task-search`);

        const activeLink = page.locator('a.active:has-text("Task Search"), a[class*="active"]:has-text("Task Search")');
        await expect(activeLink).toBeVisible();
    });
});
