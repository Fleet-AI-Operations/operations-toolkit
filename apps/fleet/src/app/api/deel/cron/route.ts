import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { syncContracts, submitTimesheets } from '@repo/core/deel';

/**
 * GET /api/deel/cron - Trigger automated Deel sync and submission
 * 
 * This endpoint is intended to be called by an external cron service (e.g. Vercel Cron, GitHub Actions)
 * It will only perform actions if 'deel_auto_sync_enabled' is set to 'true'.
 */
export async function GET(request: NextRequest) {
  // Check if automation is enabled
  const autoSyncSetting = await prisma.systemSetting.findUnique({
    where: { key: 'deel_auto_sync_enabled' }
  });

  if (autoSyncSetting?.value !== 'true') {
    return NextResponse.json({ 
      message: 'Automated sync is currently disabled in Deel Settings',
      enabled: false 
    });
  }

  try {
    // Get Deel API configuration
    const [tokenSetting, baseUrlSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_token' } }),
      prisma.systemSetting.findUnique({ where: { key: 'deel_api_base_url' } }),
    ]);

    const apiToken = tokenSetting?.value || process.env.DEEL_API_TOKEN;
    const baseUrl = baseUrlSetting?.value || process.env.DEEL_API_BASE_URL || 'http://localhost:4000';

    if (!apiToken) {
      return NextResponse.json(
        { error: 'Deel API token not configured' },
        { status: 500 }
      );
    }

    const config = { baseUrl, apiToken };
    const results: any = {};

    // 1. Sync Contracts
    console.log('[Cron] Starting contract sync...');
    results.sync = await syncContracts(
      prisma,
      config,
      {
        entryStatus: 'pending',
        overwriteExisting: false
      }
    );

    // 2. Submit Timesheets
    console.log('[Cron] Starting timesheet submission...');
    results.submission = await submitTimesheets(
      prisma,
      config,
      {
        entryStatus: 'pending',
        autoApprove: false,
        batchSize: 20,
        batchDelay: 500
      }
    );

    return NextResponse.json({
      message: 'Automated Deel processing completed',
      results
    });
  } catch (error) {
    console.error('[Cron] Deel automation error:', error);
    return NextResponse.json(
      { 
        error: 'Automation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
