import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rater-groups/[id]/members
 * Add member(s) to a rater group
 * Body: { userIds: string[] }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        // Verify group exists
        const group = await prisma.raterGroup.findUnique({
            where: { id },
            select: { id: true, name: true, projectId: true }
        });

        if (!group) {
            return NextResponse.json({ error: 'Rater group not found' }, { status: 404 });
        }

        const body = await request.json();
        const { userIds } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
        }

        // Verify all users exist
        const users = await prisma.profile.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true }
        });

        if (users.length !== userIds.length) {
            return NextResponse.json({ error: 'One or more users not found' }, { status: 404 });
        }

        // Get existing members to avoid duplicates
        const existingMembers = await prisma.raterGroupMember.findMany({
            where: {
                raterGroupId: id,
                userId: { in: userIds }
            },
            select: { userId: true }
        });

        const existingUserIds = new Set(existingMembers.map(m => m.userId));
        const newUserIds = userIds.filter((uid: string) => !existingUserIds.has(uid));

        if (newUserIds.length === 0) {
            return NextResponse.json({
                message: 'All users are already members',
                added: 0
            });
        }

        // Add new members
        await prisma.raterGroupMember.createMany({
            data: newUserIds.map((userId: string) => ({
                raterGroupId: id,
                userId
            }))
        });

        await logAudit({
            action: 'RATER_GROUP_MEMBERS_ADDED',
            entityType: 'RATER_GROUP',
            entityId: id,
            projectId: group.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { addedUserIds: newUserIds, groupName: group.name }
        });

        // Return updated group with members
        const updatedGroup = await prisma.raterGroup.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true }
                        }
                    }
                },
                _count: {
                    select: { members: true }
                }
            }
        });

        return NextResponse.json({
            group: updatedGroup,
            added: newUserIds.length,
            skipped: userIds.length - newUserIds.length
        });
    } catch (error) {
        console.error('Error adding members:', error);
        return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
    }
}
