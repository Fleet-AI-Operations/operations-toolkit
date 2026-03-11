import { test, expect } from '@playwright/test';

test.describe('Mentorship Program - Access Control', () => {
    test('redirects unauthenticated users to login from dashboard', async ({ page }) => {
        await page.goto('/mentorship-dashboard');
        await expect(page).toHaveURL(/\/login/);
    });

    test('redirects unauthenticated users to login from config', async ({ page }) => {
        await page.goto('/mentorship-config');
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Mentorship Dashboard', () => {
    test('shows dashboard heading and summary stats', async ({ page }) => {
        await page.goto('/mentorship-dashboard');

        await expect(page.locator('h1')).toContainText('Mentorship Dashboard');
        await expect(page.locator('text=Total Pods')).toBeVisible();
        await expect(page.locator('text=Total Members')).toBeVisible();
    });

    test('shows sidebar Mentorship Program section', async ({ page }) => {
        await page.goto('/mentorship-dashboard');

        await expect(page.locator('text=Mentorship Program')).toBeVisible();
        await expect(page.locator('a:has-text("Mentorship Dashboard")')).toBeVisible();
        await expect(page.locator('a:has-text("Mentorship Config")')).toBeVisible();
    });

    test('navigates from dashboard to config via sidebar', async ({ page }) => {
        await page.goto('/mentorship-dashboard');

        await page.locator('a:has-text("Mentorship Config")').click();
        await expect(page).toHaveURL(/\/mentorship-config/);
        await expect(page.locator('h1')).toContainText('Pod Configuration');
    });

    test('shows empty state when no pods exist', async ({ page }) => {
        await page.goto('/mentorship-dashboard');

        // If no pods exist, should show an appropriate empty state message
        const noPods = page.locator('text=No pods configured');
        const podsGrid = page.locator('[data-testid="pods-grid"]');
        await expect(noPods.or(podsGrid)).toBeVisible();
    });
});

test.describe('Mentorship Config', () => {
    test('shows Pod Configuration heading and New Pod button', async ({ page }) => {
        await page.goto('/mentorship-config');

        await expect(page.locator('h1')).toContainText('Pod Configuration');
        await expect(page.locator('button:has-text("New Pod")')).toBeVisible();
    });

    test('opens create pod modal on New Pod click', async ({ page }) => {
        await page.goto('/mentorship-config');

        await page.locator('button:has-text("New Pod")').click();

        await expect(page.locator('text=New Pod').last()).toBeVisible();
        await expect(page.locator('input[placeholder*="Pod"]')).toBeVisible();
        await expect(page.locator('button:has-text("Create Pod")')).toBeVisible();
    });

    test('closes modal on Cancel click', async ({ page }) => {
        await page.goto('/mentorship-config');

        await page.locator('button:has-text("New Pod")').click();
        await expect(page.locator('button:has-text("Create Pod")')).toBeVisible();

        await page.locator('button:has-text("Cancel")').click();
        await expect(page.locator('button:has-text("Create Pod")')).not.toBeVisible();
    });

    test('closes modal on backdrop click', async ({ page }) => {
        await page.goto('/mentorship-config');

        await page.locator('button:has-text("New Pod")').click();
        await expect(page.locator('button:has-text("Create Pod")')).toBeVisible();

        // Click backdrop (fixed overlay behind modal)
        await page.mouse.click(50, 50);
        await expect(page.locator('button:has-text("Create Pod")')).not.toBeVisible();
    });

    test('Add Members modal shows search input', async ({ page }) => {
        await page.goto('/mentorship-config');

        // Only run if at least one pod exists
        const addMembersBtn = page.locator('button:has-text("Add Members")');
        if (await addMembersBtn.count() > 0) {
            await addMembersBtn.first().click();

            await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
            await expect(page.locator('text=QA team members')).toBeVisible();
        }
    });

    test('search filters member list by name or email', async ({ page }) => {
        await page.goto('/mentorship-config');

        const addMembersBtn = page.locator('button:has-text("Add Members")');
        if (await addMembersBtn.count() > 0) {
            await addMembersBtn.first().click();

            const searchInput = page.locator('input[placeholder*="Search"]');
            await searchInput.fill('zzznomatchzzz');

            await expect(page.locator('text=No results for')).toBeVisible();
        }
    });
});
