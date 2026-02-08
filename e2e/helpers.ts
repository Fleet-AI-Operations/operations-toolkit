/**
 * E2E Test Helpers
 * Common utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';

/**
 * Create a test user in the database
 * Note: This creates a user in the local Supabase database
 */
export async function createTestUser(
  email: string = 'test@example.com',
  role: 'ADMIN' | 'FLEET' | 'MANAGER' | 'CORE' | 'QA' | 'USER' | 'PENDING' = 'USER'
) {
  // First, check if user exists in auth.users
  const authUser = await prisma.$queryRaw`
    SELECT id FROM auth.users WHERE email = ${email}
  `;

  let userId: string;

  if (!authUser || (authUser as any).length === 0) {
    // Create in auth.users
    const result = await prisma.$queryRaw`
      INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${email}, NOW(), NOW(), NOW())
      RETURNING id
    `;
    userId = (result as any)[0].id;
  } else {
    userId = (authUser as any)[0].id;
  }

  // Create or update in profiles
  const profile = await prisma.profile.upsert({
    where: { email },
    create: {
      id: userId,
      email,
      role,
      mustResetPassword: false,
    },
    update: {
      role,
    },
  });

  return profile;
}

/**
 * Delete a test user from the database
 */
export async function deleteTestUser(email: string) {
  // Delete from profiles (this will cascade to auth.users via ON DELETE CASCADE)
  await prisma.profile.deleteMany({
    where: { email },
  });
}

/**
 * Create a test project
 */
export async function createTestProject(
  name: string = 'Test Project',
  ownerId?: string
) {
  return await prisma.project.create({
    data: {
      name,
      ownerId,
    },
  });
}

/**
 * Delete a test project
 */
export async function deleteTestProject(name: string) {
  await prisma.project.deleteMany({
    where: { name },
  });
}

/**
 * Clean up all test data
 * Use in afterEach or afterAll hooks
 */
export async function cleanupTestData() {
  // Delete in correct order to avoid foreign key violations
  await prisma.dataRecord.deleteMany({
    where: {
      source: { startsWith: 'test' },
    },
  });

  await prisma.ingestJob.deleteMany({
    where: {
      project: {
        name: { startsWith: 'Test' },
      },
    },
  });

  await prisma.analyticsJob.deleteMany({
    where: {
      project: {
        name: { startsWith: 'Test' },
      },
    },
  });

  await prisma.project.deleteMany({
    where: {
      name: { startsWith: 'Test' },
    },
  });

  await prisma.profile.deleteMany({
    where: {
      email: { contains: 'test' },
    },
  });
}

/**
 * Login helper for E2E tests
 */
export async function login(
  page: Page,
  email: string = 'test@example.com',
  password: string = 'testpassword123'
) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (home page is /)
  await page.waitForURL(url => url.pathname === '/' || url.pathname === '/waiting-approval');
}

/**
 * Alias for login function (for clarity in tests)
 */
export async function loginAsUser(
  page: Page,
  email: string,
  password: string = 'testpassword123'
) {
  return login(page, email, password);
}

/**
 * Logout helper for E2E tests
 */
export async function logout(page: Page) {
  // First open the profile dropdown
  await page.click('[data-testid="user-profile-dropdown-trigger"]');
  // Then click the logout button
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}

/**
 * Navigate to a page and wait for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Fill a form field by label
 */
export async function fillFormField(
  page: Page,
  label: string,
  value: string
) {
  const field = page.locator(`label:has-text("${label}") + input`);
  await field.fill(value);
}

/**
 * Wait for toast/notification to appear
 */
export async function waitForToast(
  page: Page,
  message: string,
  timeout: number = 5000
) {
  await expect(
    page.locator(`[role="status"]:has-text("${message}")`)
  ).toBeVisible({ timeout });
}

/**
 * Check if Supabase is running
 * Use in test.beforeAll to ensure Supabase is ready
 */
export async function checkSupabaseHealth() {
  try {
    const response = await fetch('http://127.0.0.1:54321/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Setup test environment
 * Call in test.beforeAll
 */
export async function setupTestEnvironment() {
  const isHealthy = await checkSupabaseHealth();
  if (!isHealthy) {
    throw new Error(
      'Supabase is not running! Start it with: npm run dev:supabase'
    );
  }
}

/**
 * Teardown test environment
 * Call in test.afterAll
 */
export async function teardownTestEnvironment() {
  await cleanupTestData();
  await prisma.$disconnect();
}
