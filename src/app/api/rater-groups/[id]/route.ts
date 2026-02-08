import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rater-groups/[id]
 * Get a single rater group with members and stats
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const group = await prisma.raterGroup.findUnique({
            where: { id },
            include: {
                project: {
                    select: { id: true, name: true }
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true, role: true }
                        }
                    },
                    orderBy: { joinedAt: 'asc' }
                },
                assignments: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        totalRecords: true,
                        completedCount: true,
                        createdAt: true
                    }
                },
                _count: {
                    select: { members: true, assignments: true }
                }
            }
        });

        if (!group) {
            return NextResponse.json({ error: 'Rater group not found' }, { status: 404 });
        }

        return NextResponse.json({ group });
    } catch (error) {
        console.error('Error fetching rater group:', error);
        return NextResponse.json({ error: 'Failed to fetch rater group' }, { status: 500 });
    }
}

/**
 * PATCH /api/rater-groups/[id]
 * Update a rater group
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
        const existing = await prisma.raterGroup.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Rater group not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, any> = {};

        if (typeof body.name === 'string' && body.name.trim().length > 0) {
            // Check for duplicate name
            const duplicate = await prisma.raterGroup.findFirst({
                where: {
                    projectId: existing.projectId,
                    name: body.name.trim(),
                    id: { not: id }
                }
            });
            if (duplicate) {
                return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
            }
            updateData.name = body.name.trim();
        }

        if (body.description !== undefined) {
            updateData.description = body.description?.trim() || null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const group = await prisma.raterGroup.update({
            where: { id },
            data: updateData,
            include: {
                _count: {
                    select: { members: true, assignments: true }
                }
            }
        });

        await logAudit({
            action: 'RATER_GROUP_UPDATED',
            entityType: 'RATER_GROUP',
            entityId: group.id,
            projectId: group.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { updatedFields: Object.keys(updateData) }
        });

        return NextResponse.json({ group });
    } catch (error) {
        console.error('Error updating rater group:', error);
        return NextResponse.json({ error: 'Failed to update rater group' }, { status: 500 });
    }
}

/**
 * DELETE /api/rater-groups/[id]
 * Delete a rater group
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
        const existing = await prisma.raterGroup.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { assignments: true }
                }
            }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Rater group not found' }, { status: 404 });
        }

        // Check for active assignments
        const activeAssignments = await prisma.assignmentBatch.count({
            where: {
                raterGroupId: id,
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
        });

        if (activeAssignments > 0) {
            return NextResponse.json({
                error: 'Cannot delete group with active assignments'
            }, { status: 409 });
        }

        await prisma.raterGroup.delete({
            where: { id }
        });

        await logAudit({
            action: 'RATER_GROUP_DELETED',
            entityType: 'RATER_GROUP',
            entityId: id,
            projectId: existing.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { name: existing.name }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting rater group:', error);
        return NextResponse.json({ error: 'Failed to delete rater group' }, { status: 500 });
    }
}
