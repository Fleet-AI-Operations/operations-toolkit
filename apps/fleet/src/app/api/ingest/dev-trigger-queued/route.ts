import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { runPhase2 } from '@repo/core/ingestion';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/dev-trigger-queued
 *
 * Local development only. Finds all QUEUED_FOR_VEC jobs and runs Phase 2
 * (vectorization) directly — no webhook secret required.
 *
 * In production this returns 404. Gate with the dev-only UI button.
 */
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        console.error('[DevTriggerQueued] Auth check failed', { message: authError.message });
    }
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let profile;
    try {
        profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });
    } catch (dbErr) {
        console.error('[DevTriggerQueued] Failed to fetch profile', { userId: user.id }, dbErr);
        return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let queuedJobs;
    try {
        queuedJobs = await prisma.ingestJob.findMany({
            where: { status: 'QUEUED_FOR_VEC' },
            select: { id: true, environment: true },
            orderBy: { createdAt: 'asc' },
        });
    } catch (dbErr) {
        console.error('[DevTriggerQueued] Failed to fetch queued jobs', dbErr);
        return NextResponse.json({ error: 'Failed to query queued jobs' }, { status: 500 });
    }

    if (queuedJobs.length === 0) {
        return NextResponse.json({ message: 'No QUEUED_FOR_VEC jobs found.', triggered: 0 });
    }

    // Run Phase 2 for each job sequentially to avoid overloading the local AI server
    const results: { jobId: string; environment: string; status: string; error?: string }[] = [];
    for (const job of queuedJobs) {
        try {
            await runPhase2(job.id, job.environment);
            results.push({ jobId: job.id, environment: job.environment, status: 'triggered' });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[DevTriggerQueued] runPhase2 failed for job', job.id, err);
            results.push({ jobId: job.id, environment: job.environment, status: 'error', error: message });
        }
    }

    const succeeded = results.filter(r => r.status === 'triggered').length;
    const failed = results.filter(r => r.status === 'error').length;
    const messageParts = [];
    if (succeeded > 0) messageParts.push(`${succeeded} triggered`);
    if (failed > 0) messageParts.push(`${failed} failed`);

    return NextResponse.json({
        message: messageParts.join(', ') + '.',
        triggered: succeeded,
        failed,
        results,
    });
}
