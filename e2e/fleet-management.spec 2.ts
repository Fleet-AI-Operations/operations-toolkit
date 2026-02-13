/**
 * E2E tests for Fleet Management features
 * Tests access control and functionality for management features moved to Fleet app:
 * - Rater Groups
 * - Assignments
 *
 * These features should be accessible to FLEET and ADMIN roles (not just ADMIN)
 */

import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUser } from './helpers';

test.describe('Fleet Management - Access Control', () => {
  test('FLEET role should access Rater Groups page', async ({ page }) => {
    // Create FLEET user
    const fleetUser = await createTestUser('fleet@test.com', 'FLEET');

    try {
      // Login as FLEET user
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'fleet@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Navigate to Rater Groups (should be in Fleet app)
      await page.goto('/rater-groups');

      // Should see Rater Groups page
      await expect(page.locator('h1:has-text("Rater Groups")')).toBeVisible();
    } finally {
      await cleanupTestUser(fleetUser.id);
    }
  });

  test('FLEET role should access Assignments page', async ({ page }) => {
    // Create FLEET user
    const fleetUser = await createTestUser('fleet-assign@test.com', 'FLEET');

    try {
      // Login as FLEET user
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'fleet-assign@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Navigate to Assignments (should be in Fleet app)
      await page.goto('/assignments');

      // Should see Assignments page
      await expect(page.locator('h1:has-text("Assignment")')).toBeVisible();
    } finally {
      await cleanupTestUser(fleetUser.id);
    }
  });

  test('QA role should NOT access Rater Groups', async ({ page }) => {
    // Create QA user
    const qaUser = await createTestUser('qa-test@test.com', 'QA');

    try {
      // Login as QA user
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'qa-test@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Try to navigate to Rater Groups
      await page.goto('/rater-groups');

      // Should either redirect or show error (not the actual page)
      const heading = page.locator('h1');
      const headingText = await heading.textContent();
      expect(headingText).not.toContain('Rater Groups');
    } finally {
      await cleanupTestUser(qaUser.id);
    }
  });
});

test.describe('Fleet Management - API Access', () => {
  test('FLEET role should access Rater Groups API', async ({ page, request }) => {
    const fleetUser = await createTestUser('fleet-api@test.com', 'FLEET');

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'fleet-api@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Get cookies
      const cookies = await page.context().cookies();

      // Try to fetch rater groups (requires projectId but should not return 403)
      const response = await request.get('/api/rater-groups?projectId=test-project-id', {
        headers: {
          Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        },
      });

      // Should not be forbidden (might be 404 for missing project, but not 403)
      expect(response.status()).not.toBe(403);
    } finally {
      await cleanupTestUser(fleetUser.id);
    }
  });

  test('FLEET role should access Assignments API', async ({ page, request }) => {
    const fleetUser = await createTestUser('fleet-api2@test.com', 'FLEET');

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'fleet-api2@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Get cookies
      const cookies = await page.context().cookies();

      // Try to fetch assignments
      const response = await request.get('/api/assignments', {
        headers: {
          Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        },
      });

      // Should return 200 (not 403 Forbidden)
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('batches');
    } finally {
      await cleanupTestUser(fleetUser.id);
    }
  });

  test('QA role should NOT access Assignments API', async ({ page, request }) => {
    const qaUser = await createTestUser('qa-api@test.com', 'QA');

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'qa-api@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Get cookies
      const cookies = await page.context().cookies();

      // Try to fetch assignments - should be forbidden
      const response = await request.get('/api/assignments', {
        headers: {
          Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        },
      });

      // Should return 403 Forbidden
      expect(response.status()).toBe(403);
    } finally {
      await cleanupTestUser(qaUser.id);
    }
  });
});

test.describe('Fleet Management - Sidebar Navigation', () => {
  test('FLEET role should see Management section in sidebar', async ({ page }) => {
    const fleetUser = await createTestUser('fleet-nav@test.com', 'FLEET');

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'fleet-nav@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Should see Management section with Rater Groups and Assignments
      await expect(page.locator('text=Management').first()).toBeVisible();
      await expect(page.locator('a[href="/rater-groups"]')).toBeVisible();
      await expect(page.locator('a[href="/assignments"]')).toBeVisible();
    } finally {
      await cleanupTestUser(fleetUser.id);
    }
  });

  test('QA role should NOT see Management section in sidebar', async ({ page }) => {
    const qaUser = await createTestUser('qa-nav@test.com', 'QA');

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'qa-nav@test.com');
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Should NOT see Management section
      const managementSection = page.locator('text=Management').first();
      await expect(managementSection).not.toBeVisible();
    } finally {
      await cleanupTestUser(qaUser.id);
    }
  });
});
