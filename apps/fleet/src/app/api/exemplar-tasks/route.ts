import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { getEmbedding } from '@repo/core/ai';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';

async function requireFleetAuth(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[ExemplarTasks] Failed to fetch profile for user', user.id, profileError);
        return { error: NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }) };
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user, profile };
}

/**
 * GET /api/exemplar-tasks?environment=X
 * List all exemplar tasks for an environment (no embedding in payload), newest first.
 */
export async function GET(request: NextRequest) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const environment = request.nextUrl.searchParams.get('environment') || '';

    try {
        // Single query — includes embedding status to avoid a second round-trip
        const exemplars = environment
            ? await prisma.$queryRaw<Array<{
                id: string; environment: string; content: string;
                createdById: string | null; createdAt: Date; updatedAt: Date; hasEmbedding: boolean;
            }>>`
                SELECT id, environment, content,
                       created_by_id AS "createdById",
                       created_at    AS "createdAt",
                       updated_at    AS "updatedAt",
                       (embedding IS NOT NULL) AS "hasEmbedding"
                FROM exemplar_tasks
                WHERE environment = ${environment}
                ORDER BY created_at DESC
            `
            : await prisma.$queryRaw<Array<{
                id: string; environment: string; content: string;
                createdById: string | null; createdAt: Date; updatedAt: Date; hasEmbedding: boolean;
            }>>`
                SELECT id, environment, content,
                       created_by_id AS "createdById",
                       created_at    AS "createdAt",
                       updated_at    AS "updatedAt",
                       (embedding IS NOT NULL) AS "hasEmbedding"
                FROM exemplar_tasks
                ORDER BY created_at DESC
            `;

        return NextResponse.json({ exemplars });
    } catch (err) {
        console.error('[ExemplarTasks] Error fetching exemplar tasks:', err);
        return NextResponse.json({ error: 'Failed to fetch exemplar tasks' }, { status: 500 });
    }
}

/**
 * POST /api/exemplar-tasks
 * Create an exemplar task and generate its embedding.
 * Body: { environment, content }
 */
export async function POST(request: NextRequest) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;
    const { user } = authResult;

    try {
        const body = await request.json();
        const { environment, content } = body;

        if (!environment || !content?.trim()) {
            return NextResponse.json({ error: 'environment and content are required' }, { status: 400 });
        }

        const id = crypto.randomUUID();

        const exemplar = await prisma.exemplarTask.create({
            data: {
                id,
                environment,
                content: content.trim(),
                createdById: user!.id,
            },
            select: {
                id: true,
                environment: true,
                content: true,
                createdById: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Generate and store embedding
        let hasEmbedding = false;
        let embeddingWarning: string | undefined;
        try {
            const embedding = await getEmbedding(content.trim());
            if (embedding && embedding.length > 0) {
                const vectorStr = `[${embedding.join(',')}]`;
                await prisma.$executeRaw`
                    UPDATE exemplar_tasks
                    SET embedding = ${vectorStr}::vector
                    WHERE id = ${id}
                `;
                hasEmbedding = true;
            } else {
                embeddingWarning = 'Task saved but embedding generation failed. Use "Generate Missing Embeddings" to retry.';
            }
        } catch (embeddingError) {
            console.error('[ExemplarTasks] Failed to generate embedding for', id, embeddingError);
            embeddingWarning = 'Task saved but embedding generation failed. Use "Generate Missing Embeddings" to retry.';
        }

        logAudit({
            action: 'EXEMPLAR_TASK_CREATED',
            entityType: 'EXEMPLAR_TASK',
            entityId: exemplar.id,
            userId: user!.id,
            userEmail: user!.email ?? 'unknown',
            metadata: { environment, hasEmbedding },
        }).catch(err => console.error('[ExemplarTasks] Audit log failed:', err));

        return NextResponse.json(
            { exemplar: { ...exemplar, hasEmbedding }, ...(embeddingWarning && { embeddingWarning }) },
            { status: 201 }
        );
    } catch (err) {
        console.error('[ExemplarTasks] Error creating exemplar task:', err);
        return NextResponse.json({ error: 'Failed to create exemplar task' }, { status: 500 });
    }
}
