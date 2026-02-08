import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { cancelEvaluation, getEvaluationJobStatus } from '@/lib/evaluation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/evaluation/bulk-llm/[jobId]/cancel
 * Cancel a running evaluation job
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const job = await getEvaluationJobStatus(jobId);

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (!['PENDING', 'PROCESSING'].includes(job.status)) {
            return NextResponse.json({
                error: 'Job is not running',
                status: job.status
            }, { status: 400 });
        }

        await cancelEvaluation(jobId);

        await logAudit({
            action: 'BULK_EVALUATION_CANCELLED',
            entityType: 'LLM_EVALUATION_JOB',
            entityId: jobId,
            projectId: job.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { modelConfigId: job.modelConfigId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling job:', error);
        return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }
}
