import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { getEvaluationJobStatus } from '@repo/core/evaluation';

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
    if (!['ADMIN', 'FLEET'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
