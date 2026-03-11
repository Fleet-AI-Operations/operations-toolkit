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
 * PATCH /api/exemplar-tasks/[id]
 * Update an exemplar task's content.
 * Regenerates embedding if content changes.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    try {
        const body = await request.json();
        const { content } = body;

        const existing = await prisma.exemplarTask.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Exemplar task not found' }, { status: 404 });
        }

        const updateData: { content?: string } = {};
        if (content !== undefined) {
            if (typeof content !== 'string' || !content.trim()) {
                return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 });
            }
            updateData.content = content.trim();
        }

        const exemplar = await prisma.exemplarTask.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                environment: true,
                content: true,
                createdById: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Regenerate embedding if content changed
        let hasEmbedding = false;
        let embeddingWarning: string | undefined;
        if (content !== undefined && content.trim() !== existing.content) {
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
                    embeddingWarning = 'Content saved but embedding generation failed. Use "Generate Missing Embeddings" to retry.';
                }
            } catch (embeddingError) {
                console.error('[ExemplarTasks] Failed to regenerate embedding for', id, embeddingError);
                embeddingWarning = 'Content saved but embedding generation failed. Use "Generate Missing Embeddings" to retry.';
            }
        } else {
            // Check if it already has an embedding
            const rows = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM exemplar_tasks WHERE id = ${id} AND embedding IS NOT NULL
            `;
            hasEmbedding = rows.length > 0;
        }

        logAudit({
            action: 'EXEMPLAR_TASK_UPDATED',
            entityType: 'EXEMPLAR_TASK',
            entityId: id,
            userId: authResult.user!.id,
            userEmail: authResult.user!.email ?? 'unknown',
            metadata: { environment: exemplar.environment, contentChanged: content !== undefined && content.trim() !== existing.content },
        }).catch(err => console.error('[ExemplarTasks] Audit log failed:', err));

        return NextResponse.json({
            exemplar: { ...exemplar, hasEmbedding },
            ...(embeddingWarning && { embeddingWarning }),
        });
    } catch (err) {
        console.error('[ExemplarTasks] Error updating exemplar task', id, err);
        return NextResponse.json({ error: 'Failed to update exemplar task' }, { status: 500 });
    }
}

/**
 * DELETE /api/exemplar-tasks/[id]
 * Delete an exemplar task.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    try {
        await prisma.exemplarTask.delete({ where: { id } });

        logAudit({
            action: 'EXEMPLAR_TASK_DELETED',
            entityType: 'EXEMPLAR_TASK',
            entityId: id,
            userId: authResult.user!.id,
            userEmail: authResult.user!.email ?? 'unknown',
        }).catch(err => console.error('[ExemplarTasks] Audit log failed:', err));

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code === 'P2025') {
            return NextResponse.json({ error: 'Exemplar task not found' }, { status: 404 });
        }
        console.error('[ExemplarTasks] Error deleting exemplar task', id, err);
        return NextResponse.json({ error: 'Failed to delete exemplar task' }, { status: 500 });
    }
}
