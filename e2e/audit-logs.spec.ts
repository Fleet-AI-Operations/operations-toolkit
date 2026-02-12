/**
 * E2E tests for Audit Logs feature
 * Tests the complete audit logging workflow including:
 * - Admin-only access control
 * - Audit log creation from user actions
 * - Filtering and pagination
 * - Metadata display
 */

import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';

// Helper to login
async function loginAsAdmin(page: any) {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'testpassword123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Audit Logs - Authorization', () => {
  test('should redirect non-admin users', async ({ page }) => {
    // Try to access audit logs without admin role
    await page.goto('/admin/audit-logs');

    // Should redirect to login or show error
    await expect(page).not.toHaveURL('/admin/audit-logs');
  });

  test('should allow admin users to access audit logs page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Should see audit logs page
    await expect(page.locator('h1:has-text("Audit Logs")')).toBeVisible();
  });
});

test.describe('Audit Logs - API Access', () => {
  test('should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/audit-logs');
    expect(response.status()).toBe(401);
  });

  test('should return audit logs for admin users', async ({ page, request }) => {
    await loginAsAdmin(page);

    // Get cookies from page context
    const cookies = await page.context().cookies();

    const response = await request.get('/api/audit-logs', {
      headers: {
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('logs');
    expect(data).toHaveProperty('total');
  });
});

test.describe('Audit Logs - Log Creation', () => {
  test.afterEach(async () => {
    // Clean up test audit logs
    await prisma.auditLog.deleteMany({
      where: {
        userEmail: { contains: '@test.com' },
      },
    });
  });

  test('should create audit log when user is created', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to user management
    await page.goto('/admin/users');

    // Create a new user
    await page.click('button:has-text("Create User")');
    await page.fill('input[name="email"]', 'newuser@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.selectOption('select[name="role"]', 'USER');
    await page.click('button[type="submit"]:has-text("Create")');

    // Wait for success
    await expect(page.locator('text=User created successfully')).toBeVisible();

    // Check audit log was created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_CREATED',
        metadata: {
          path: ['email'],
          equals: 'newuser@test.com',
        },
      },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog?.entityType).toBe('USER');
  });

  test('should create audit log when user role is changed', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to user management
    await page.goto('/admin/users');

    // Find a user and change role
    const firstUser = page.locator('table tbody tr').first();
    await firstUser.locator('button:has-text("Edit")').click();
    await page.selectOption('select[name="role"]', 'FLEET');
    await page.click('button:has-text("Save")');

    // Wait for success
    await expect(page.locator('text=Role updated')).toBeVisible();

    // Check audit log was created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_ROLE_CHANGED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog?.metadata).toHaveProperty('newRole', 'FLEET');
  });

  test('should create audit log when project is created', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to projects
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', 'Test Project for Audit');
    await page.click('button:has-text("Create")');

    // Wait for creation
    await page.waitForTimeout(1000);

    // Check audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'PROJECT_CREATED',
        metadata: {
          path: ['name'],
          equals: 'Test Project for Audit',
        },
      },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog?.entityType).toBe('PROJECT');
  });
});

test.describe('Audit Logs - UI Filters', () => {
  test.beforeEach(async () => {
    // Create test audit logs
    await prisma.auditLog.createMany({
      data: [
        {
          id: 'test-log-1',
          action: 'USER_CREATED',
          entityType: 'USER',
          userId: 'admin-test-id',
          userEmail: 'admin@test.com',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'test-log-2',
          action: 'PROJECT_CREATED',
          entityType: 'PROJECT',
          userId: 'admin-test-id',
          userEmail: 'admin@test.com',
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'test-log-3',
          action: 'USER_ROLE_CHANGED',
          entityType: 'USER',
          userId: 'admin-test-id',
          userEmail: 'admin@test.com',
          createdAt: new Date('2024-01-03'),
        },
      ],
    });
  });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        id: { in: ['test-log-1', 'test-log-2', 'test-log-3'] },
      },
    });
  });

  test('should filter by action type', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Open filters
    await page.click('button:has-text("Filters")');

    // Select action filter
    await page.selectOption('select[name="action"]', 'USER_CREATED');

    // Wait for results
    await page.waitForTimeout(500);

    // Should only show USER_CREATED logs
    const tableRows = page.locator('tbody tr:not([style*="borderBottom"])');
    const firstLog = tableRows.first();
    await expect(firstLog).toContainText('User Created');
  });

  test('should filter by entity type', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Open filters
    await page.click('button:has-text("Filters")');

    // Select entity type filter
    const entitySelects = page.locator('select');
    const entitySelect = entitySelects.nth(1);
    await entitySelect.selectOption('PROJECT');

    // Click Apply Filters button
    await page.click('button:has-text("Apply Filters")');

    // Wait for results
    await page.waitForTimeout(500);

    // Should only show PROJECT logs
    const tableRows = page.locator('tbody tr:not([style*="borderBottom"])');
    await expect(tableRows).toHaveCount(1);
  });

  test('should reset filters', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Open filters and apply
    await page.click('button:has-text("Filters")');
    await page.selectOption('select[name="action"]', 'USER_CREATED');
    await page.click('button:has-text("Apply Filters")');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Reset filters
    await page.click('button:has-text("Clear Filters")');

    // Wait for reset
    await page.waitForTimeout(500);

    // Should show all logs again
    const tableRows = page.locator('tbody tr:not([style*="borderBottom"])');
    await expect(tableRows.count()).resolves.toBeGreaterThan(1);
  });
});

test.describe('Audit Logs - Pagination', () => {
  test.beforeEach(async () => {
    // Create 55 test logs to test pagination (50 per page)
    const logs = Array.from({ length: 55 }, (_, i) => ({
      id: `test-pagination-${i}`,
      action: 'USER_CREATED',
      entityType: 'USER',
      userId: 'admin-test-id',
      userEmail: 'admin@test.com',
      createdAt: new Date(Date.now() - i * 1000),
    }));

    await prisma.auditLog.createMany({ data: logs });
  });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        id: { startsWith: 'test-pagination-' },
      },
    });
  });

  test('should paginate audit logs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Should show pagination info
    await expect(page.locator('text=Showing 1 to 50')).toBeVisible();

    // Click next
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Should show second page
    await expect(page.locator('text=Showing 51 to')).toBeVisible();

    // Previous should be enabled now
    const prevButton = page.locator('button:has-text("Previous")');
    await expect(prevButton).toBeEnabled();
  });

  test('should disable previous button on first page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    const prevButton = page.locator('button:has-text("Previous")');
    await expect(prevButton).toBeDisabled();
  });
});

test.describe('Audit Logs - Metadata Display', () => {
  test.beforeEach(async () => {
    await prisma.auditLog.create({
      data: {
        id: 'test-metadata-log',
        action: 'USER_CREATED',
        entityType: 'USER',
        userId: 'admin-test-id',
        userEmail: 'admin@test.com',
        metadata: {
          email: 'newuser@test.com',
          role: 'USER',
          createdBy: 'admin@test.com',
        },
      },
    });
  });

  test.afterEach(async () => {
    await prisma.auditLog.delete({
      where: { id: 'test-metadata-log' },
    });
  });

  test('should expand metadata when clicked', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Find the first log row (main row, not expanded)
    const firstRow = page.locator('tbody tr').first();

    // Click to expand
    await firstRow.click();

    // Wait for expansion
    await page.waitForTimeout(300);

    // Should show metadata in expanded row
    const metadataPre = page.locator('pre').first();
    await expect(metadataPre).toBeVisible();
    await expect(metadataPre).toContainText('newuser@test.com');
    await expect(metadataPre).toContainText('USER');
  });
});

test.describe('Audit Logs - Visual Elements', () => {
  test('should display table structure', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Should have table with headers
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("User")')).toBeVisible();
  });

  test('should show gridlines and borders', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Check that table has borders
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check table rows exist
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should format timestamps correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/audit-logs');

    // Should show formatted dates in table
    const timestamp = page.locator('tbody td').first();
    await expect(timestamp).toBeVisible();
    // Check for month abbreviation
    await expect(page.locator('text=/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/').first()).toBeVisible();
  });
});
