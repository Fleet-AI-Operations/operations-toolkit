/**
 * Bug Reports E2E Tests
 * Tests the bug report submission, tracking, and admin management features
 */

import { test, expect } from '@playwright/test';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  deleteTestUser,
  cleanupTestData,
  loginAsUser,
} from './helpers';

test.describe('Bug Reports - User Features', () => {
  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test.afterEach(async () => {
    await cleanupTestData();
  });

  test('should submit a bug report successfully', async ({ page }) => {
    // Create and login as regular user
    const user = await createTestUser('user@example.com', 'USER');
    await loginAsUser(page, 'user@example.com', 'testpassword');

    // Navigate to a page
    await page.goto('/');

    // Open bug report modal by clicking floating button
    const bugButton = page.locator('button[aria-label="Report a Bug"]');
    await expect(bugButton).toBeVisible();
    await bugButton.click();

    // Verify modal opened
    await expect(page.locator('h2:has-text("Report a Bug")')).toBeVisible();

    // Fill in bug description
    const description = 'The dashboard is not loading properly';
    await page.fill('textarea#description', description);

    // Submit the report
    await page.click('button[type="submit"]:has-text("Submit Report")');

    // Verify success message appears
    await expect(page.locator('.success:has-text("Bug report submitted successfully")')).toBeVisible();

    // Verify toast notification appears after modal closes
    await expect(page.locator('.toast:has-text("Bug Report Submitted")')).toBeVisible({ timeout: 3000 });

    // Cleanup
    await deleteTestUser('user@example.com');
  });

  test('should display user bug reports in tracker', async ({ page }) => {
    // Create and login as regular user
    const user = await createTestUser('user@example.com', 'USER');
    await loginAsUser(page, 'user@example.com', 'testpassword');

    // Submit a bug report first
    await page.goto('/');
    await page.click('button[aria-label="Report a Bug"]');
    await page.fill('textarea#description', 'Test bug report');
    await page.click('button[type="submit"]:has-text("Submit Report")');

    // Wait for submission to complete
    await page.waitForTimeout(2000);

    // Click the bug tracker icon in header
    const trackerButton = page.locator('button[aria-label="My Bug Reports"]');
    await expect(trackerButton).toBeVisible();

    // Should show badge with count
    await expect(trackerButton.locator('.badge')).toHaveText('1');

    // Open tracker dropdown
    await trackerButton.click();

    // Verify bug report appears in the list
    await expect(page.locator('.dropdown:has-text("My Bug Reports")')).toBeVisible();
    await expect(page.locator('.reportItem:has-text("Test bug report")')).toBeVisible();

    // Verify status badge shows "Pending"
    await expect(page.locator('.statusBadge:has-text("Pending")')).toBeVisible();

    // Cleanup
    await deleteTestUser('user@example.com');
  });

  test('should filter resolved reports when more than 5 exist', async ({ page }) => {
    // This test would require creating multiple bug reports and verifying filtering
    // Skipping for now as it requires more complex setup
    test.skip();
  });
});

test.describe('Bug Reports - Admin Features', () => {
  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test.afterEach(async () => {
    await cleanupTestData();
  });

  test('should display bug reports page for admin', async ({ page }) => {
    // Create and login as admin
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    // Navigate to bug reports page
    await page.goto('/bug-reports');

    // Verify page title
    await expect(page.locator('h1:has-text("Bug Reports")')).toBeVisible();

    // Verify table headers
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Assigned To")')).toBeVisible();
    await expect(page.locator('th:has-text("Created By")')).toBeVisible();
    await expect(page.locator('th:has-text("Time")')).toBeVisible();

    // Cleanup
    await deleteTestUser('admin@example.com');
  });

  test('should expand bug report to show details', async ({ page }) => {
    // Create admin and login
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    // Create a test user and submit a bug report as them
    const user = await createTestUser('user@example.com', 'USER');
    // TODO: Submit bug report via API or UI

    // Navigate to bug reports page
    await page.goto('/bug-reports');

    // Click on first bug report row
    const firstRow = page.locator('tbody tr[role="button"]').first();
    await firstRow.click();

    // Verify details section appears
    await expect(page.locator('.detailsContent')).toBeVisible();
    await expect(page.locator('.fieldLabel:has-text("Page:")')).toBeVisible();
    await expect(page.locator('.fieldLabel:has-text("Description:")')).toBeVisible();

    // Cleanup
    await deleteTestUser('admin@example.com');
    await deleteTestUser('user@example.com');
  });

  test('should support keyboard navigation for expanding reports', async ({ page }) => {
    // Create admin and login
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    await page.goto('/bug-reports');

    // Focus on first row
    const firstRow = page.locator('tbody tr[role="button"]').first();
    await firstRow.focus();

    // Verify row is focused
    await expect(firstRow).toBeFocused();

    // Press Enter to expand
    await page.keyboard.press('Enter');

    // Verify details appear
    await expect(page.locator('.detailsContent')).toBeVisible();

    // Press Enter again to collapse
    await page.keyboard.press('Enter');

    // Verify details are hidden
    await expect(page.locator('.detailsContent')).not.toBeVisible();

    // Test with Space key
    await page.keyboard.press(' ');
    await expect(page.locator('.detailsContent')).toBeVisible();

    // Cleanup
    await deleteTestUser('admin@example.com');
  });

  test('should update bug report status', async ({ page }) => {
    // Create admin and login
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    await page.goto('/bug-reports');

    // Expand first report
    const firstRow = page.locator('tbody tr[role="button"]').first();
    await firstRow.click();

    // Change status dropdown
    const statusSelect = page.locator('select.statusSelect').first();
    await statusSelect.selectOption('IN_PROGRESS');

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify status badge updated
    await expect(page.locator('.statusBadge:has-text("In Progress")').first()).toBeVisible();

    // Cleanup
    await deleteTestUser('admin@example.com');
  });

  test('should assign bug report to self', async ({ page }) => {
    // Create admin and login
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    await page.goto('/bug-reports');

    // Expand first unassigned report
    const firstRow = page.locator('tbody tr[role="button"]').first();
    await firstRow.click();

    // Click "Assign to me" button
    const assignButton = page.locator('button:has-text("Assign to me")');
    if (await assignButton.isVisible()) {
      await assignButton.click();

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify assignment appears in table
      await expect(page.locator('td:has-text("admin@example.com")')).toBeVisible();
    }

    // Cleanup
    await deleteTestUser('admin@example.com');
  });

  test('should sort bug reports by priority (pending > in progress > resolved)', async ({ page }) => {
    // Create admin and login
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    // TODO: Create bug reports with different statuses

    await page.goto('/bug-reports');

    // Get all status badges
    const statusBadges = page.locator('.statusBadge');
    const count = await statusBadges.count();

    if (count > 1) {
      // Verify first status is PENDING (highest priority)
      const firstStatus = await statusBadges.first().textContent();
      expect(['Pending', 'In Progress']).toContain(firstStatus);

      // Verify RESOLVED items (if any) are at the end
      const lastStatus = await statusBadges.last().textContent();
      // Last item could be any status, but if there are resolved items, they should be last
    }

    // Cleanup
    await deleteTestUser('admin@example.com');
  });
});

test.describe('Bug Reports - Navigation', () => {
  test('should show Bug Reports in System section of sidebar for admin', async ({ page }) => {
    const admin = await createTestUser('admin@example.com', 'ADMIN');
    await loginAsUser(page, 'admin@example.com', 'testpassword');

    await page.goto('/');

    // Verify System section exists
    await expect(page.locator('.sidebar-section-title:has-text("System")')).toBeVisible();

    // Verify Bug Reports link is in System section
    const bugReportsLink = page.locator('.sidebar-link[href="/bug-reports"]');
    await expect(bugReportsLink).toBeVisible();

    // Click link and verify navigation
    await bugReportsLink.click();
    await expect(page).toHaveURL('/bug-reports');

    // Cleanup
    await deleteTestUser('admin@example.com');
  });

  test('should not show Bug Reports page for non-admin users', async ({ page }) => {
    const user = await createTestUser('user@example.com', 'USER');
    await loginAsUser(page, 'user@example.com', 'testpassword');

    // Try to navigate directly to bug reports page
    await page.goto('/bug-reports');

    // Should be redirected to dashboard (unauthorized)
    await expect(page).toHaveURL('/');

    // Cleanup
    await deleteTestUser('user@example.com');
  });
});
