/**
 * Retry Failed Job API
 *
 * Allows admins to manually retry a failed job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DatabaseQueue } from '@/lib/queue/db-queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is ADMIN
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Verify job exists and is failed
    const job = await DatabaseQueue.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: `Job is in ${job.status} status, can only retry FAILED jobs` },
        { status: 400 }
      );
    }

    // Retry the job
    await DatabaseQueue.retryJob(jobId);

    return NextResponse.json({
      success: true,
      message: 'Job queued for retry',
      jobId,
    });
  } catch (error) {
    console.error('[Queue Retry API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retry job',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
