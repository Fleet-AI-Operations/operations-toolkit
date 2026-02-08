import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';
import { startBulkEvaluation, startBulkEvaluationAllModels, getProjectEvaluationJobs } from '@repo/core/evaluation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/evaluation/bulk-llm
 * List evaluation jobs for a project
 */
export async function GET(request: NextRequest) {
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
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get('projectId');
        const limit = parseInt(searchParams.get('limit') || '20');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const jobs = await getProjectEvaluationJobs(projectId, limit);
        return NextResponse.json({ jobs });
    } catch (error) {
        console.error('Error fetching evaluation jobs:', error);
        return NextResponse.json({ error: 'Failed to fetch evaluation jobs' }, { status: 500 });
    }
}

/**
 * POST /api/evaluation/bulk-llm
 * Start a bulk evaluation job
 * Body: { projectId, modelConfigId?, allModels?: boolean }
 */
export async function POST(request: NextRequest) {
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

    const postRole = (profile as any)?.role;
    if (!['ADMIN', 'MANAGER'].includes(postRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { projectId, modelConfigId, allModels } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        let jobIds: string[];

        if (allModels) {
            // Start evaluation for all active models
            jobIds = await startBulkEvaluationAllModels(projectId);

            if (jobIds.length === 0) {
                return NextResponse.json({
                    error: 'No active models available or all records already evaluated'
                }, { status: 400 });
            }

            await logAudit({
                action: 'BULK_EVALUATION_STARTED',
                entityType: 'LLM_EVALUATION_JOB',
                projectId,
                userId: user.id,
                userEmail: user.email!,
                metadata: { jobIds, allModels: true }
            });

            return NextResponse.json({
                success: true,
                message: `Started ${jobIds.length} evaluation job(s)`,
                jobIds
            }, { status: 201 });
        } else {
            // Start evaluation for specific model
            if (!modelConfigId) {
                return NextResponse.json({ error: 'modelConfigId is required' }, { status: 400 });
            }

            const jobId = await startBulkEvaluation(projectId, modelConfigId);

            await logAudit({
                action: 'BULK_EVALUATION_STARTED',
                entityType: 'LLM_EVALUATION_JOB',
                entityId: jobId,
                projectId,
                userId: user.id,
                userEmail: user.email!,
                metadata: { modelConfigId }
            });

            return NextResponse.json({
                success: true,
                jobId
            }, { status: 201 });
        }
    } catch (error: any) {
        console.error('Error starting bulk evaluation:', error);
        return NextResponse.json({
            error: error.message || 'Failed to start evaluation'
        }, { status: 500 });
    }
}
