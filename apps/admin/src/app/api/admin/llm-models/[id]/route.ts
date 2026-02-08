import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/llm-models/[id]
 * Get a single LLM model configuration with stats
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        const model = await prisma.lLMModelConfig.findUnique({
            where: { id },
            include: {
                evaluationJobs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        status: true,
                        totalRecords: true,
                        processedCount: true,
                        errorCount: true,
                        tokensUsed: true,
                        cost: true,
                        createdAt: true,
                        completedAt: true,
                        project: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        if (!model) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        return NextResponse.json({ model });
    } catch (error) {
        console.error('Error fetching LLM model:', error);
        return NextResponse.json({ error: 'Failed to fetch LLM model' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/llm-models/[id]
 * Update an LLM model configuration
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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

    const patchRole = (profile as any)?.role;
    if (!['ADMIN', 'MANAGER'].includes(patchRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const existing = await prisma.lLMModelConfig.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, any> = {};

        // Only update fields that are provided
        if (typeof body.name === 'string' && body.name.trim().length > 0) {
            updateData.name = body.name.trim();
        }

        if (typeof body.modelId === 'string' && body.modelId.trim().length > 0) {
            // Check for duplicate modelId (excluding current record)
            const duplicate = await prisma.lLMModelConfig.findFirst({
                where: {
                    modelId: body.modelId.trim(),
                    id: { not: id }
                }
            });
            if (duplicate) {
                return NextResponse.json({ error: 'A model with this ID already exists' }, { status: 409 });
            }
            updateData.modelId = body.modelId.trim();
        }

        if (typeof body.isActive === 'boolean') {
            updateData.isActive = body.isActive;
        }

        if (typeof body.priority === 'number') {
            updateData.priority = body.priority;
        }

        if (body.inputCostPer1k !== undefined) {
            updateData.inputCostPer1k = typeof body.inputCostPer1k === 'number' ? body.inputCostPer1k : null;
        }

        if (body.outputCostPer1k !== undefined) {
            updateData.outputCostPer1k = typeof body.outputCostPer1k === 'number' ? body.outputCostPer1k : null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const model = await prisma.lLMModelConfig.update({
            where: { id },
            data: updateData
        });

        await logAudit({
            action: 'LLM_MODEL_UPDATED',
            entityType: 'LLM_MODEL_CONFIG',
            entityId: model.id,
            userId: user.id,
            userEmail: user.email!,
            metadata: { updatedFields: Object.keys(updateData) }
        });

        return NextResponse.json({ model });
    } catch (error) {
        console.error('Error updating LLM model:', error);
        return NextResponse.json({ error: 'Failed to update LLM model' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/llm-models/[id]
 * Delete an LLM model configuration
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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

    const deleteRole = (profile as any)?.role;
    if (!['ADMIN', 'MANAGER'].includes(deleteRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const existing = await prisma.lLMModelConfig.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { evaluationJobs: true }
                }
            }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        // Check if there are active jobs
        const activeJobs = await prisma.lLMEvaluationJob.count({
            where: {
                modelConfigId: id,
                status: { in: ['PENDING', 'PROCESSING'] }
            }
        });

        if (activeJobs > 0) {
            return NextResponse.json({
                error: 'Cannot delete model with active evaluation jobs. Cancel or wait for jobs to complete.'
            }, { status: 409 });
        }

        await prisma.lLMModelConfig.delete({
            where: { id }
        });

        await logAudit({
            action: 'LLM_MODEL_DELETED',
            entityType: 'LLM_MODEL_CONFIG',
            entityId: id,
            userId: user.id,
            userEmail: user.email!,
            metadata: { name: existing.name, modelId: existing.modelId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting LLM model:', error);
        return NextResponse.json({ error: 'Failed to delete LLM model' }, { status: 500 });
    }
}
