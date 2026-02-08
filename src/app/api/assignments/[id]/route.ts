import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments/[id]
 * Get a single assignment batch with records
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Any authenticated user can view assignment details
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.error;

    try {
        const batch = await prisma.assignmentBatch.findUnique({
            where: { id },
            include: {
                project: {
                    select: { id: true, name: true }
                },
                raterGroup: {
                    select: { id: true, name: true }
                },
                assignedToUser: {
                    select: { id: true, email: true }
                },
                createdBy: {
                    select: { id: true, email: true }
                },
                records: {
                    include: {
                        record: {
                            select: {
                                id: true,
                                content: true,
                                category: true,
                                type: true
                            }
                        },
                        assignedToUser: {
                            select: { id: true, email: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { records: true }
                }
            }
        });

        if (!batch) {
            return NextResponse.json({ error: 'Assignment batch not found' }, { status: 404 });
        }

        return NextResponse.json({ batch });
    } catch (error) {
        console.error('Error fetching assignment batch:', error);
        return NextResponse.json({ error: 'Failed to fetch assignment batch' }, { status: 500 });
    }
}

/**
 * PATCH /api/assignments/[id]
 * Update an assignment batch
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const existing = await prisma.assignmentBatch.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Assignment batch not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, any> = {};

        if (typeof body.name === 'string' && body.name.trim().length > 0) {
            updateData.name = body.name.trim();
        }

        if (body.description !== undefined) {
            updateData.description = body.description?.trim() || null;
        }

        if (body.status !== undefined) {
            const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
            if (!validStatuses.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            updateData.status = body.status;
        }

        if (body.dueDate !== undefined) {
            updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const batch = await prisma.assignmentBatch.update({
            where: { id },
            data: updateData,
            include: {
                raterGroup: { select: { id: true, name: true } },
                assignedToUser: { select: { id: true, email: true } },
                _count: { select: { records: true } }
            }
        });

        await logAudit({
            action: 'ASSIGNMENT_BATCH_UPDATED',
            entityType: 'ASSIGNMENT_BATCH',
            entityId: batch.id,
            projectId: batch.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { updatedFields: Object.keys(updateData) }
        });

        return NextResponse.json({ batch });
    } catch (error) {
        console.error('Error updating assignment batch:', error);
        return NextResponse.json({ error: 'Failed to update assignment batch' }, { status: 500 });
    }
}

/**
 * DELETE /api/assignments/[id]
 * Delete an assignment batch
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const existing = await prisma.assignmentBatch.findUnique({
            where: { id },
            select: { id: true, name: true, projectId: true, status: true }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Assignment batch not found' }, { status: 404 });
        }

        await prisma.assignmentBatch.delete({
            where: { id }
        });

        await logAudit({
            action: 'ASSIGNMENT_BATCH_DELETED',
            entityType: 'ASSIGNMENT_BATCH',
            entityId: id,
            projectId: existing.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { name: existing.name }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting assignment batch:', error);
        return NextResponse.json({ error: 'Failed to delete assignment batch' }, { status: 500 });
    }
}
