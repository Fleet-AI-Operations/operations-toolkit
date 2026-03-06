import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { runPhase1 } from '@repo/core/ingestion';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/dev-trigger-pending
 *
 * Local development only. Finds all PENDING jobs and runs Phase 1
 * (data loading) directly — no webhook secret required.
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
        console.error('[DevTriggerPending] Auth check failed', { message: authError.message });
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
        console.error('[DevTriggerPending] Failed to fetch profile', { userId: user.id }, dbErr);
        return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let pendingJobs;
    try {
        pendingJobs = await prisma.ingestJob.findMany({
            where: { status: 'PENDING' },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });
    } catch (dbErr) {
        console.error('[DevTriggerPending] Failed to fetch pending jobs', dbErr);
        return NextResponse.json({ error: 'Failed to query pending jobs' }, { status: 500 });
    }

    if (pendingJobs.length === 0) {
        return NextResponse.json({ message: 'No PENDING jobs found.', triggered: 0 });
    }

    const results: { jobId: string; status: string; error?: string }[] = [];
    for (const job of pendingJobs) {
        try {
            await runPhase1(job.id);
            results.push({ jobId: job.id, status: 'triggered' });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[DevTriggerPending] runPhase1 failed for job', job.id, err);
            results.push({ jobId: job.id, status: 'error', error: message });
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
