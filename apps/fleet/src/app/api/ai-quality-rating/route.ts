import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';
import { requireRole } from '@repo/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai-quality-rating?environment=X
 * List AI quality jobs for an environment, most recent first.
 */
export async function GET(request: NextRequest) {
    const authResult = await requireRole(request, ['FLEET', 'MANAGER', 'ADMIN']);
    if (authResult.error) return authResult.error;

    const environment = request.nextUrl.searchParams.get('environment');
    if (!environment) {
        return NextResponse.json({ error: 'environment is required' }, { status: 400 });
    }

    try {
        const jobs = await prisma.aIQualityJob.findMany({
            where: { environment },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return NextResponse.json({ jobs });
    } catch (error) {
        console.error('Error fetching AI quality jobs:', error);
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
}

/**
 * POST /api/ai-quality-rating
 * Start a new AI quality rating job for an environment.
 * Body: { environment: string }
 */
export async function POST(request: NextRequest) {
    const authResult = await requireRole(request, ['FLEET', 'MANAGER', 'ADMIN']);
    if (authResult.error) return authResult.error;

    try {
        const body = await request.json();
        const { environment } = body;

        if (!environment) {
            return NextResponse.json({ error: 'environment is required' }, { status: 400 });
        }

        // Check for an already-running job
        const existingJob = await prisma.aIQualityJob.findFirst({
            where: {
                environment,
                status: { in: ['PENDING', 'PROCESSING'] },
            },
        });

        if (existingJob) {
            return NextResponse.json({ jobId: existingJob.id, existing: true });
        }

        // Count TASK records in environment
        const totalRecords = await prisma.dataRecord.count({
            where: { environment, type: 'TASK' },
        });

        if (totalRecords === 0) {
            return NextResponse.json({ error: 'No TASK records found in this environment' }, { status: 400 });
        }

        // Create job
        const jobId = crypto.randomUUID();
        await prisma.aIQualityJob.create({
            data: {
                id: jobId,
                environment,
                status: 'PENDING',
                totalRecords,
            },
        });

        await logAudit({
            action: 'AI_QUALITY_RATING_JOB_STARTED',
            entityType: 'AI_REQUEST',
            entityId: jobId,
            userId: authResult.user!.id,
            userEmail: authResult.user!.email!,
            metadata: { jobId, environment, totalRecords },
        });

        // Fire-and-forget: kick off first batch
        const baseUrl = process.env.NEXT_PUBLIC_FLEET_APP_URL || 'http://localhost:3004';
        fetch(`${baseUrl}/api/ai-quality-rating/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '' },
            body: JSON.stringify({ jobId }),
        }).catch(e => console.error('[AIQualityRating] Failed to start process:', e));

        return NextResponse.json({ jobId }, { status: 201 });
    } catch (error) {
        console.error('Error starting AI quality rating job:', error);
        return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
    }
}
