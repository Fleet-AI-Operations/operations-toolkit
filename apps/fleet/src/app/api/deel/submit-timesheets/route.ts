import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { submitTimesheets, getTimesheetSubmitStats } from '@repo/core/deel';
import { requireAnyRole } from '@/lib/auth-helpers';

/**
 * GET /api/deel/submit-timesheets - Get timesheet submission statistics
 *
 * Returns summary of time entries by submission status
 * Requires: FLEET or ADMIN role
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAnyRole(request, ['FLEET', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    // Get submission stats
    const stats = await getTimesheetSubmitStats(prisma);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching timesheet submission stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet submission stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deel/submit-timesheets - Manually trigger timesheet submission
 *
 * Submits time entries to Deel as timesheets
 * Requires: FLEET or ADMIN role
 *
 * Request body:
 * {
 *   entryStatus?: string,   // Filter time entries by status (default: 'pending')
 *   autoApprove?: boolean,  // Auto-approve timesheets on submission
 *   batchSize?: number,     // Number of entries to process per batch (default: 10)
 *   batchDelay?: number     // Delay between batches in ms (default: 1000)
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
    const { entryStatus, autoApprove, batchSize, batchDelay } = body;

    // Trigger submission
    console.log('Starting timesheet submission...');
    const result = await submitTimesheets(
      prisma,
      {
        baseUrl: deelApiBaseUrl,
        apiToken: deelApiToken,
      },
      {
        entryStatus: entryStatus || 'pending',
        autoApprove: autoApprove || false,
        batchSize: batchSize || 10,
        batchDelay: batchDelay || 1000,
      }
    );

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          message: 'Submission completed with errors',
          result,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      message: 'Timesheet submission completed successfully',
      result,
    });
  } catch (error) {
    console.error('Error submitting timesheets:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit timesheets',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
