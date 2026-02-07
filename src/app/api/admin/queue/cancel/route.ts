/**
 * Cancel Job API
 *
 * Allows admins to cancel pending or processing jobs.
 * Requires ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get the job
    const job = await prisma.jobQueue.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Only allow cancelling PENDING or PROCESSING jobs
    if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
      return NextResponse.json(
        { error: 'Can only cancel PENDING or PROCESSING jobs' },
        { status: 400 }
      );
    }

    // Cancel the job
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        result: {
          error: 'Job cancelled by admin',
          cancelledBy: user.email,
          cancelledAt: new Date().toISOString(),
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[Queue Cancel] Job ${jobId} cancelled by ${user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Queue Cancel API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
