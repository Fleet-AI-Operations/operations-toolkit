import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireAnyRole } from '@/lib/auth-helpers';

/**
 * GET /api/deel/settings - Get Deel API configuration
 *
 * Returns current Deel API settings (token masked for security)
 * Requires: FLEET or ADMIN role
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAnyRole(request, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    const [tokenSetting, baseUrlSetting, autoSyncSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_token' } }),
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_base_url' } }),
      prisma.systemSetting.findUnique({ where: { key: 'deel_auto_sync_enabled' } }),
    ]);

    // Mask token for security (show only last 4 characters)
    const hasToken = !!(tokenSetting?.value || process.env.DEEL_API_TOKEN);
    const tokenPreview = tokenSetting?.value
      ? `***${tokenSetting.value.slice(-4)}`
      : process.env.DEEL_API_TOKEN
      ? '(from environment)'
      : null;

    const baseUrl = baseUrlSetting?.value || process.env.DEEL_API_BASE_URL || 'http://localhost:4000';

    return NextResponse.json({
      hasToken,
      tokenPreview,
      baseUrl,
      autoSyncEnabled: autoSyncSetting?.value === 'true',
      isProduction: baseUrl.includes('letsdeel.com'),
    });
  } catch (error) {
    console.error('Error fetching Deel settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Deel settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deel/settings - Update Deel API configuration
 *
 * Updates Deel API settings in system_settings table
 * Requires: FLEET or ADMIN role
 *
 * Request body:
 * {
 *   apiToken?: string,  // Deel API token
 *   baseUrl?: string    // Deel API base URL
 * }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAnyRole(request, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { apiToken, baseUrl, autoSyncEnabled } = body;

    // Validate inputs
    if (apiToken !== undefined && typeof apiToken !== 'string') {
      return NextResponse.json(
        { error: 'Invalid apiToken format' },
        { status: 400 }
      );
    }

    if (baseUrl !== undefined && typeof baseUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid baseUrl format' },
        { status: 400 }
      );
    }

    // Validate baseUrl format
    if (baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid baseUrl: must be a valid URL' },
          { status: 400 }
        );
      }
    }

    // Update settings
    const updates = [];

    if (apiToken !== undefined) {
      if (apiToken.trim() === '') {
        // Delete token if empty
        updates.push(
          prisma.systemSetting.deleteMany({
            where: { key: 'deel_api_token' },
          })
        );
      } else {
        updates.push(
          prisma.systemSetting.upsert({
            where: { key: 'deel_api_token' },
            update: { value: apiToken.trim() },
            create: {
              key: 'deel_api_token',
              value: apiToken.trim(),
              description: 'Deel API authentication token',
            },
          })
        );
      }
    }

    if (baseUrl !== undefined) {
      if (baseUrl.trim() === '') {
        // Delete baseUrl if empty (will fall back to environment or default)
        updates.push(
          prisma.systemSetting.deleteMany({
            where: { key: 'deel_api_base_url' },
          })
        );
      } else {
        updates.push(
          prisma.systemSetting.upsert({
            where: { key: 'deel_api_base_url' },
            update: { value: baseUrl.trim() },
            create: {
              key: 'deel_api_base_url',
              value: baseUrl.trim(),
              description: 'Deel API base URL',
            },
          })
        );
      }
    }

    if (autoSyncEnabled !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'deel_auto_sync_enabled' },
          update: { value: autoSyncEnabled ? 'true' : 'false' },
          create: {
            key: 'deel_auto_sync_enabled',
            value: autoSyncEnabled ? 'true' : 'false',
            description: 'Whether to automatically sync Deel contracts and submit timesheets',
          },
        })
      );
    }

    await prisma.$transaction(updates);

    return NextResponse.json({
      message: 'Deel settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating Deel settings:', error);
    return NextResponse.json(
      {
        error: 'Failed to update Deel settings',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
