import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { getEvaluationJobStatus } from '@/lib/evaluation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/evaluation/bulk-llm/[jobId]
 * Get status of a specific evaluation job
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;

    try {
        const job = await getEvaluationJobStatus(jobId);

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({ job });
    } catch (error) {
        console.error('Error fetching job status:', error);
        return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
    }
}
