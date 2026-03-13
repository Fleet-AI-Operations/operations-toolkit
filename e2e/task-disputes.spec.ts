import { test, expect } from '@playwright/test';

const FLEET_URL = 'http://localhost:3004';
const ADMIN_URL = 'http://localhost:3005';

test.describe('Task Disputes - Access Control', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show Task Disputes page for FLEET users', async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await expect(page.locator('h1')).toContainText('Task Disputes');
  });

  test('should show Task Disputes link in Fleet sidebar', async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await expect(page.locator('a:has-text("Task Disputes")')).toBeVisible();
  });
});

test.describe('Task Disputes - Page Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await page.waitForLoadState('networkidle');
  });

  test('should show stat cards', async ({ page }) => {
    // Stats section appears once data loads; may show empty state if no data
    const statsOrEmpty = page.locator('[style*="border-left"]').first()
      .or(page.locator('text=/No disputes imported/i'));
    await expect(statsOrEmpty).toBeVisible({ timeout: 5000 });
  });

  test('should show filter section', async ({ page }) => {
    await expect(page.locator('label:has-text("Email"), text=/Email/i').first()).toBeVisible();
    await expect(page.locator('label:has-text("Task Key"), text=/Task Key/i').first()).toBeVisible();
    await expect(page.locator('label:has-text("Status"), text=/Status/i').first()).toBeVisible();
  });

  test('should show email filter input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="email" i]')).toBeVisible();
  });

  test('should show task key filter input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="task key" i]')).toBeVisible();
  });

  test('should show environment, status, modality, and match dropdowns', async ({ page }) => {
    await expect(page.locator('select').nth(0)).toBeVisible(); // environment
    await expect(page.locator('select').nth(1)).toBeVisible(); // status
    await expect(page.locator('select').nth(2)).toBeVisible(); // modality
    await expect(page.locator('select').nth(3)).toBeVisible(); // match
  });

  test('should show disputes table or empty state', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('text=/No disputes imported yet/i');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Task Disputes - Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await page.waitForLoadState('networkidle');
  });

  test('should not show Clear button when no filters are active', async ({ page }) => {
    await expect(page.locator('button:has-text("Clear")')).not.toBeVisible();
  });

  test('should show Clear button after typing in email filter', async ({ page }) => {
    await page.locator('input[placeholder*="email" i]').fill('test@example.com');
    await expect(page.locator('button:has-text("Clear")')).toBeVisible({ timeout: 1000 });
  });

  test('should clear email filter when Clear button is clicked', async ({ page }) => {
    const emailInput = page.locator('input[placeholder*="email" i]');
    await emailInput.fill('test@example.com');
    await page.locator('button:has-text("Clear")').click();
    await expect(emailInput).toHaveValue('');
  });

  test('status dropdown should have pending, approved, rejected, discarded options', async ({ page }) => {
    const statusSelect = page.locator('select').nth(1);
    await expect(statusSelect.locator('option[value="pending"]')).toHaveCount(1);
    await expect(statusSelect.locator('option[value="approved"]')).toHaveCount(1);
    await expect(statusSelect.locator('option[value="rejected"]')).toHaveCount(1);
    await expect(statusSelect.locator('option[value="discarded"]')).toHaveCount(1);
  });

  test('match dropdown should have matched and unmatched options', async ({ page }) => {
    const matchSelect = page.locator('select').nth(3);
    await expect(matchSelect.locator('option[value="true"]')).toHaveCount(1);
    await expect(matchSelect.locator('option[value="false"]')).toHaveCount(1);
  });
});

test.describe('Task Disputes - Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await page.waitForLoadState('networkidle');
  });

  test('should show column headers when table is visible', async ({ page }) => {
    const table = page.locator('table');
    const isEmpty = await page.locator('text=/No disputes imported yet/i').isVisible();
    if (isEmpty) return;

    await expect(table).toBeVisible();
    await expect(table.locator('th:has-text("Status")')).toBeVisible();
    await expect(table.locator('th:has-text("Disputer")')).toBeVisible();
    await expect(table.locator('th:has-text("Task Key")')).toBeVisible();
    await expect(table.locator('th:has-text("Match")')).toBeVisible();
  });

  test('should expand a row when clicked', async ({ page }) => {
    const isEmpty = await page.locator('text=/No disputes imported yet/i').isVisible();
    if (isEmpty) return;

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    await expect(page.locator('text=/Dispute Details/i')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=/Linked Record/i')).toBeVisible();
  });

  test('should collapse an expanded row when clicked again', async ({ page }) => {
    const isEmpty = await page.locator('text=/No disputes imported yet/i').isVisible();
    if (isEmpty) return;

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await expect(page.locator('text=/Dispute Details/i')).toBeVisible();

    await firstRow.click();
    await expect(page.locator('text=/Dispute Details/i')).not.toBeVisible();
  });
});

test.describe('Task Disputes - Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FLEET_URL}/task-disputes`);
    await page.waitForLoadState('networkidle');
  });

  test('should show pagination controls when there are multiple pages', async ({ page }) => {
    const isEmpty = await page.locator('text=/No disputes imported yet/i').isVisible();
    if (isEmpty) return;

    // Pagination only shows when total > 25
    const pagination = page.locator('button:has-text("Prev"), button:has-text("Next")').first();
    const singlePage = page.locator('text=/Showing 1/i');
    await expect(pagination.or(singlePage)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Task Disputes Import - Access Control', () => {
  test('should redirect unauthenticated users to login on import page', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/task-disputes-import`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show import page for ADMIN users', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/task-disputes-import`);
    await expect(page.locator('h1')).toContainText('Import Disputes CSV');
  });
});

test.describe('Task Disputes Import - Page Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/task-disputes-import`);
    await page.waitForLoadState('networkidle');
  });

  test('should show file drop zone', async ({ page }) => {
    await expect(page.locator('text=/Drop CSV file here/i')).toBeVisible();
  });

  test('should show Select file button', async ({ page }) => {
    await expect(page.locator('button:has-text("Select file")')).toBeVisible();
  });

  test('should show Import button disabled when no file is selected', async ({ page }) => {
    await expect(page.locator('button:has-text("Import")')).toBeDisabled();
  });
});
