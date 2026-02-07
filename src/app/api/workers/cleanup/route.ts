/**
 * Cleanup Worker
 *
 * This worker runs daily to clean up old completed and failed jobs from the queue.
 * This prevents the job_queue table from growing indefinitely.
 *
 * Cron Schedule: Daily at 2:00 AM UTC (defined in vercel.json)
 * Retention Policy: Keep jobs for 7 days after completion
 */

import { NextResponse } from 'next/server';
import { DatabaseQueue } from '@/lib/queue/db-queue';

export const dynamic = 'force-dynamic';

/**
 * GET handler for Vercel Cron
 */
export async function GET(request: Request) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Security: Require CRON_SECRET in production
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Cleanup Worker] CRON_SECRET not set in production - worker endpoints are unauthenticated!');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    console.warn('[Cleanup Worker] CRON_SECRET not set - worker endpoint is unauthenticated');
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cleanup Worker] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cleanup Worker] Starting cleanup...');

  try {
    const deletedCount = await DatabaseQueue.cleanup(7); // Keep 7 days of history

    console.log(`[Cleanup Worker] Cleaned up ${deletedCount} old jobs`);

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error('[Cleanup Worker] Cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Cleanup error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
