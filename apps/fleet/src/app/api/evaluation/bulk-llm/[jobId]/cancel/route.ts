import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';
import { cancelEvaluation, getEvaluationJobStatus } from '@repo/core/evaluation';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = (profile as any)?.role;
    if (!['ADMIN', 'MANAGER'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
            userEmail: user.email!,
            metadata: { modelConfigId: job.modelConfigId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling job:', error);
        return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }
}
