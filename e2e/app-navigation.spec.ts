/**
 * E2E tests for app navigation and landing pages
 * Tests the UI/UX improvements: landing page redirects, sidebar navigation, dashboard removal
 *
 * Run against specific apps:
 *   APP_UNDER_TEST=fleet npm run test:e2e
 *   APP_UNDER_TEST=core npm run test:e2e
 *   APP_UNDER_TEST=qa npm run test:e2e
 *   APP_UNDER_TEST=user npm run test:e2e
 */

import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUser } from './helpers';

const APP_CONFIGS = {
  fleet: {
    role: 'FLEET',
    expectedLandingPath: '/analytics',
    expectedHeading: /Analytics/i,
    shouldHaveAlignmentScoring: false,
  },
  core: {
    role: 'CORE',
    expectedLandingPath: '/likert-scoring',
    expectedHeading: /Likert|Scoring/i,
    shouldHaveAlignmentScoring: true,
  },
  qa: {
    role: 'QA',
    expectedLandingPath: '/records',
    expectedHeading: /Records|Tasks/i,
    shouldHaveAlignmentScoring: false,
  },
  user: {
    role: 'USER',
    expectedLandingPath: '/time-tracking',
    expectedHeading: /Time|Tracking/i,
    shouldHaveAlignmentScoring: false,
  },
};

const appUnderTest = (process.env.APP_UNDER_TEST || 'fleet') as keyof typeof APP_CONFIGS;
const config = APP_CONFIGS[appUnderTest];

test.describe(`${appUnderTest.toUpperCase()} App Navigation`, () => {
  test('should redirect home to correct landing page', async ({ page }) => {
    const user = await createTestUser(`${appUnderTest}-home@test.com`, config.role);

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', `${appUnderTest}-home@test.com`);
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');

      // Should redirect to expected landing page
      await expect(page).toHaveURL(new RegExp(config.expectedLandingPath));

      // Verify page loaded correctly
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    } finally {
      await cleanupTestUser(user.id);
    }
  });

  test('should not have Dashboard in sidebar', async ({ page }) => {
    const user = await createTestUser(`${appUnderTest}-sidebar@test.com`, config.role);

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', `${appUnderTest}-sidebar@test.com`);
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL(new RegExp(config.expectedLandingPath));

      // Should not see Dashboard link
      const dashboardLinks = await page.locator('a').filter({ hasText: /^Dashboard$/i }).count();
      expect(dashboardLinks).toBe(0);
    } finally {
      await cleanupTestUser(user.id);
    }
  });

  test(`should ${config.shouldHaveAlignmentScoring ? '' : 'NOT '}have Alignment Scoring available`, async ({ page }) => {
    const user = await createTestUser(`${appUnderTest}-align@test.com`, config.role);

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', `${appUnderTest}-align@test.com`);
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL(new RegExp(config.expectedLandingPath));

      if (config.shouldHaveAlignmentScoring) {
        // Core app should have Alignment Scoring in sidebar
        await expect(page.locator('a[href="/alignment-scoring"]')).toBeVisible();

        // Should be able to navigate to it
        await page.goto('/alignment-scoring');
        await expect(page).toHaveURL(/\/alignment-scoring/);
      } else {
        // Other apps should NOT have Alignment Scoring
        const alignmentLinks = await page.locator('a[href="/alignment-scoring"]').count();
        expect(alignmentLinks).toBe(0);

        // Trying to navigate directly should not work (redirect or 404)
        const response = await page.goto('/alignment-scoring');
        if (response) {
          // If page loads, check that we're not on alignment-scoring
          const url = page.url();
          expect(url).not.toContain('/alignment-scoring');
        }
      }
    } finally {
      await cleanupTestUser(user.id);
    }
  });

  test('sidebar should have navigation items', async ({ page }) => {
    const user = await createTestUser(`${appUnderTest}-nav@test.com`, config.role);

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', `${appUnderTest}-nav@test.com`);
      await page.fill('input[type="password"]', 'testpassword123');
      await page.click('button[type="submit"]');
      await page.waitForURL(new RegExp(config.expectedLandingPath));

      // Should have sidebar with navigation links
      const sidebarLinks = await page.locator('.sidebar-link, a[class*="sidebar"]').count();
      expect(sidebarLinks).toBeGreaterThan(0);
    } finally {
      await cleanupTestUser(user.id);
    }
  });
});
