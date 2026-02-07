/**
 * Queue Statistics API
 *
 * Returns queue metrics and recent jobs for monitoring dashboard.
 * Requires ADMIN role.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DatabaseQueue } from '@/lib/queue/db-queue';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    // Import prisma
    const { prisma } = await import('@/lib/prisma');

    // Get queue statistics
    const stats = await DatabaseQueue.getQueueStats();

    // Get recent jobs (last 20) - transform to snake_case for frontend
    const recentJobsRaw = await prisma.jobQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const recentJobs = recentJobsRaw.map(job => ({
      id: job.id,
      job_type: job.jobType,
      status: job.status,
      priority: job.priority,
      payload: job.payload,
      result: job.result,
      attempts: job.attempts,
      max_attempts: job.maxAttempts,
      scheduled_for: job.scheduledFor,
      started_at: job.startedAt,
      completed_at: job.completedAt,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      progress: job.progress,
    }));

    // Get failed jobs - transform to snake_case for frontend
    const failedJobsRaw = await prisma.jobQueue.findMany({
      where: { status: 'FAILED' },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });
    const failedJobs = failedJobsRaw.map(job => ({
      id: job.id,
      job_type: job.jobType,
      status: job.status,
      priority: job.priority,
      payload: job.payload,
      result: job.result,
      attempts: job.attempts,
      max_attempts: job.maxAttempts,
      scheduled_for: job.scheduledFor,
      started_at: job.startedAt,
      completed_at: job.completedAt,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      progress: job.progress,
    }));

    // Get performance metrics (last 24 hours)
    const completedJobs = await prisma.jobQueue.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        jobType: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Calculate average processing time by job type
    const performanceMetrics: Record<string, { count: number; avgDuration: number }> = {};

    completedJobs.forEach((job) => {
      if (job.startedAt && job.completedAt) {
        const duration =
          (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;

        if (!performanceMetrics[job.jobType]) {
          performanceMetrics[job.jobType] = { count: 0, avgDuration: 0 };
        }

        const metric = performanceMetrics[job.jobType];
        metric.avgDuration =
          (metric.avgDuration * metric.count + duration) / (metric.count + 1);
        metric.count++;
      }
    });

    return NextResponse.json({
      stats,
      recentJobs,
      failedJobs,
      performanceMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Queue Stats API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch queue statistics',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
