import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/llm-models
 * List all LLM model configurations
 */
export async function GET() {
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
        const models = await prisma.lLMModelConfig.findMany({
            orderBy: [
                { priority: 'asc' },
                { name: 'asc' }
            ],
            include: {
                _count: {
                    select: {
                        evaluationJobs: true
                    }
                }
            }
        });

        return NextResponse.json({ models });
    } catch (error) {
        console.error('Error fetching LLM models:', error);
        return NextResponse.json({ error: 'Failed to fetch LLM models' }, { status: 500 });
    }
}

/**
 * POST /api/admin/llm-models
 * Create a new LLM model configuration
 */
export async function POST(request: Request) {
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
        const { name, modelId, isActive, priority, inputCostPer1k, outputCostPer1k } = body;

        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!modelId || typeof modelId !== 'string' || modelId.trim().length === 0) {
            return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
        }

        // Check for duplicate modelId
        const existing = await prisma.lLMModelConfig.findUnique({
            where: { modelId: modelId.trim() }
        });

        if (existing) {
            return NextResponse.json({ error: 'A model with this ID already exists' }, { status: 409 });
        }

        const model = await prisma.lLMModelConfig.create({
            data: {
                name: name.trim(),
                modelId: modelId.trim(),
                isActive: isActive !== false,
                priority: typeof priority === 'number' ? priority : 0,
                inputCostPer1k: typeof inputCostPer1k === 'number' ? inputCostPer1k : null,
                outputCostPer1k: typeof outputCostPer1k === 'number' ? outputCostPer1k : null,
            }
        });

        await logAudit({
            action: 'LLM_MODEL_CREATED',
            entityType: 'LLM_MODEL_CONFIG',
            entityId: model.id,
            userId: user.id,
            userEmail: user.email!,
            metadata: { name: model.name, modelId: model.modelId }
        });

        return NextResponse.json({ model }, { status: 201 });
    } catch (error) {
        console.error('Error creating LLM model:', error);
        return NextResponse.json({ error: 'Failed to create LLM model' }, { status: 500 });
    }
}
