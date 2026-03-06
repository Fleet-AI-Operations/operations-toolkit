import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3004';

test.describe('Prompt Authenticity - Access Control', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show page for FLEET users', async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await expect(page.locator('h1')).toContainText('Prompt Authenticity Checker');
  });
});

test.describe('Prompt Authenticity - Import Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await expect(page.locator('h1')).toContainText('Prompt Authenticity Checker');
  });

  test('should show CSV Import mode by default', async ({ page }) => {
    await expect(page.locator('button:has-text("CSV Import")')).toBeVisible();
    await expect(page.locator('button:has-text("From Database")')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should switch to From Database mode', async ({ page }) => {
    await page.click('button:has-text("From Database")');
    await expect(page.locator('text=data_records')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // environment select
  });

  test('From Database form should show all filter fields', async ({ page }) => {
    await page.click('button:has-text("From Database")');
    await expect(page.locator('label:has-text("Environment")')).toBeVisible();
    await expect(page.locator('label:has-text("Record Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
    await expect(page.locator('label:has-text("End Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Filter by User")')).toBeVisible();
    await expect(page.locator('button:has-text("Preview Count")')).toBeVisible();
    await expect(page.locator('button:has-text("Sync to Queue")')).toBeVisible();
  });

  test('date inputs should have dark color scheme', async ({ page }) => {
    await page.click('button:has-text("From Database")');
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const colorScheme = await dateInputs.nth(i).evaluate(
        (el) => (el as HTMLInputElement).style.colorScheme
      );
      expect(colorScheme).toBe('dark');
    }
  });

  test('environment dropdown should be populated on import tab', async ({ page }) => {
    await page.click('button:has-text("From Database")');
    const envSelect = page.locator('select').first();
    await expect(envSelect).toBeVisible();
    // First option should always be "All environments"
    const firstOption = envSelect.locator('option').first();
    await expect(firstOption).toHaveText('All environments');
  });

  test('should show database statistics', async ({ page }) => {
    await expect(page.locator('text=Database Statistics')).toBeVisible();
    await expect(page.locator('text=Total Records')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});

test.describe('Prompt Authenticity - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await expect(page.locator('h1')).toContainText('Prompt Authenticity Checker');
  });

  test('should show all four tabs', async ({ page }) => {
    await expect(page.locator('button:has-text("Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Analyze")')).toBeVisible();
    await expect(page.locator('button:has-text("Results")')).toBeVisible();
    await expect(page.locator('button:has-text("Patterns")')).toBeVisible();
  });

  test('should navigate to Analyze tab', async ({ page }) => {
    await page.click('button:has-text("Analyze")');
    await expect(page.locator('h2:has-text("Start Analysis Job")')).toBeVisible();
  });

  test('should navigate to Results tab', async ({ page }) => {
    await page.click('button:has-text("Results")');
    await expect(page.locator('h2:has-text("Analysis Results")')).toBeVisible();
  });

  test('should navigate to Patterns tab', async ({ page }) => {
    await page.click('button:has-text("Patterns")');
    await expect(page.locator('h2:has-text("User Template Patterns")')).toBeVisible();
  });
});

test.describe('Prompt Authenticity - Analyze Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await page.click('button:has-text("Analyze")');
  });

  test('should show date range filters with dark color scheme', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const colorScheme = await dateInputs.nth(i).evaluate(
        (el) => (el as HTMLInputElement).style.colorScheme
      );
      expect(colorScheme).toBe('dark');
    }
  });

  test('should show Start Analysis button', async ({ page }) => {
    await expect(page.locator('button:has-text("Start Analysis Job")')).toBeVisible();
  });

  test('should show job history section', async ({ page }) => {
    await expect(page.locator('h3:has-text("Job History")')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });
});

test.describe('Prompt Authenticity - Results Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await page.click('button:has-text("Results")');
  });

  test('should show four stat cards including Templated', async ({ page }) => {
    await expect(page.locator('text=Total Analyzed')).toBeVisible();
    await expect(page.locator('text=Non-Native')).toBeVisible();
    await expect(page.locator('text=AI-Generated')).toBeVisible();
    await expect(page.locator('text=Templated')).toBeVisible();
  });

  test('should show search and filter controls', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search by name"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('filter dropdown should include Templated option', async ({ page }) => {
    const filterSelect = page.locator('select');
    const options = await filterSelect.locator('option').allTextContents();
    expect(options).toContain('Templated Only');
  });

  test('results table should not have a Version ID column', async ({ page }) => {
    // Version ID was removed to prevent content cut-off
    const headers = page.locator('th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).not.toContain('Version ID');
    expect(headerTexts).toContain('Templated');
  });

  test('should show export CSV link', async ({ page }) => {
    await expect(page.locator('a:has-text("Export to CSV")')).toBeVisible();
  });
});

test.describe('Prompt Authenticity - Patterns Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/prompt-authenticity`);
    await page.click('button:has-text("Patterns")');
  });

  test('should show environment filter populated without visiting Import tab first', async ({ page }) => {
    // Environments must load on mount, not just when Import tab is active
    const envSelect = page.locator('select').first();
    await expect(envSelect).toBeVisible();
    const firstOption = envSelect.locator('option').first();
    await expect(firstOption).toHaveText('All environments');
  });

  test('should show Min Prompts filter', async ({ page }) => {
    await expect(page.locator('label:has-text("Min Prompts")')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
  });

  test('should show Load Users button', async ({ page }) => {
    await expect(page.locator('button:has-text("Load Users")')).toBeVisible();
  });

  test('should show empty state when no users loaded', async ({ page }) => {
    await expect(
      page.locator('text=No users found. Run analysis first, then load users.')
    ).toBeVisible();
  });
});

test.describe('Prompt Authenticity - API Access Control', () => {
  test('sync-from-records GET should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get(`${BASE}/api/prompt-authenticity/sync-from-records`);
    expect(response.status()).toBe(401);
  });

  test('sync-from-records POST should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.post(`${BASE}/api/prompt-authenticity/sync-from-records`, {
      data: { recordType: 'TASK' },
    });
    expect(response.status()).toBe(401);
  });

  test('user-patterns GET should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get(`${BASE}/api/prompt-authenticity/user-patterns`);
    expect(response.status()).toBe(401);
  });

  test('user-patterns POST should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.post(`${BASE}/api/prompt-authenticity/user-patterns`, {
      data: { email: 'test@example.com' },
    });
    expect(response.status()).toBe(401);
  });

  test('results GET should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get(`${BASE}/api/prompt-authenticity/results`);
    expect(response.status()).toBe(401);
  });
});
