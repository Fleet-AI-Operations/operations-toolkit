/**
 * E2E Test Helpers
 * Common utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for E2E tests
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Create a test user in the database with authentication
 * Note: This creates a user in the local Supabase with a working password
 */
export async function createTestUser(
  email: string = 'test@example.com',
  role: 'ADMIN' | 'FLEET' | 'MANAGER' | 'CORE' | 'QA' | 'USER' = 'USER'
) {
  try {
    // Create user with Supabase Admin API (sets up authentication properly)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: {
        role
      }
    });

    if (authError) {
      // User might already exist, try to get existing user
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const user = existingUser?.users.find(u => u.email === email);

      if (user) {
        // Update existing user's password
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: 'testpassword123',
          email_confirm: true
        });

        // Update profile
        const profile = await prisma.profile.upsert({
          where: { email },
          create: {
            id: user.id,
            email,
            role,
            mustResetPassword: false,
          },
          update: {
            role,
            mustResetPassword: false,
          },
        });

        return profile;
      }

      throw authError;
    }

    const userId = authData.user.id;

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
        mustResetPassword: false,
      },
    });

    return profile;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

/**
 * Delete a test user from the database
 */
export async function deleteTestUser(email: string) {
  // Get user ID first
  const profile = await prisma.profile.findUnique({ where: { email } });

  if (profile) {
    // Delete from Supabase Auth
    await supabaseAdmin.auth.admin.deleteUser(profile.id);

    // Delete from profiles
    await prisma.profile.delete({ where: { id: profile.id } }).catch(() => {
      // Ignore errors if already deleted
    });
  }
}

/**
 * Clean up a specific test user by ID
 */
export async function cleanupTestUser(userId: string) {
  try {
    // Delete from Supabase Auth first
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // Delete from profiles
    await prisma.profile.delete({
      where: { id: userId },
    }).catch(() => {
      // Ignore errors if user doesn't exist
    });
  } catch (error) {
    // Ignore errors during cleanup
    console.warn('Error cleaning up test user:', error);
  }
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
  await page.waitForURL(url => url.pathname === '/');
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
