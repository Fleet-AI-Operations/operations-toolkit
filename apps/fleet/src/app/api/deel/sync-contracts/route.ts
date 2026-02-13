import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { syncContracts, getContractSyncStats } from '@repo/core/deel';
import { requireAnyRole } from '@/lib/auth-helpers';

/**
 * GET /api/deel/sync-contracts - Get contract sync statistics
 *
 * Returns summary of time entries by contract sync status
 * Requires: FLEET or ADMIN role
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAnyRole(request, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    // Get sync stats
    const stats = await getContractSyncStats(prisma);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching contract sync stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract sync stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deel/sync-contracts - Manually trigger contract sync
 *
 * Fetches contracts from Deel API and updates time entries with contract IDs
 * Requires: FLEET or ADMIN role
 *
 * Request body:
 * {
 *   entryStatus?: string,        // Filter time entries by status (default: 'pending')
 *   contractStatuses?: string[], // Filter Deel contracts by status
 *   overwriteExisting?: boolean  // Whether to update entries that already have contract_id
 * }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAnyRole(request, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    // Get Deel API configuration from system settings or environment
    let deelApiToken = process.env.DEEL_API_TOKEN;
    let deelApiBaseUrl = process.env.DEEL_API_BASE_URL || 'http://localhost:4000';

    // Check system settings for production configuration
    const [tokenSetting, baseUrlSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_token' } }),
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_base_url' } }),
    ]);

    if (tokenSetting?.value) {
      deelApiToken = tokenSetting.value;
    }
    if (baseUrlSetting?.value) {
      deelApiBaseUrl = baseUrlSetting.value;
    }

    if (!deelApiToken) {
      return NextResponse.json(
        { error: 'Deel API token not configured. Please configure in Deel Settings.' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { entryStatus, contractStatuses, overwriteExisting } = body;

    // Trigger sync
    console.log('Starting contract sync...');
    const result = await syncContracts(
      prisma,
      {
        baseUrl: deelApiBaseUrl,
        apiToken: deelApiToken,
      },
      {
        entryStatus: entryStatus || 'pending',
        contractStatuses,
        overwriteExisting: overwriteExisting || false,
      }
    );

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          message: 'Sync completed with errors',
          result,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      message: 'Contract sync completed successfully',
      result,
    });
  } catch (error) {
    console.error('Error syncing contracts:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync contracts',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
