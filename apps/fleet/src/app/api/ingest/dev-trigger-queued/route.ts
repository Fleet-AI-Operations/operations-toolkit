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
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true }
    });
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const queuedJobs = await prisma.ingestJob.findMany({
        where: { status: 'QUEUED_FOR_VEC' },
        select: { id: true, environment: true },
        orderBy: { createdAt: 'asc' },
    });

    if (queuedJobs.length === 0) {
        return NextResponse.json({ message: 'No QUEUED_FOR_VEC jobs found.', triggered: 0 });
    }

    // Run Phase 2 for each job sequentially to avoid overloading the local AI server
    const results = [];
    for (const job of queuedJobs) {
        try {
            await runPhase2(job.id, job.environment);
            results.push({ jobId: job.id, environment: job.environment, status: 'triggered' });
        } catch (err: any) {
            results.push({ jobId: job.id, environment: job.environment, status: 'error', error: err.message });
        }
    }

    return NextResponse.json({
        message: `Triggered ${results.length} job(s).`,
        triggered: results.length,
        results,
    });
}
