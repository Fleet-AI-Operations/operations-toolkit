import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/rater-groups/[id]/members/[userId]
 * Remove a member from a rater group
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const { id, userId } = await params;
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

    if (!profile || !['ADMIN', 'MANAGER'].includes((profile as any)?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // Find the membership
        const membership = await prisma.raterGroupMember.findFirst({
            where: {
                raterGroupId: id,
                userId
            },
            include: {
                raterGroup: {
                    select: { name: true, projectId: true }
                },
                user: {
                    select: { email: true }
                }
            }
        });

        if (!membership) {
            return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
        }

        // Check if user has pending assignments in this group
        const pendingAssignments = await prisma.assignmentRecord.count({
            where: {
                assignedToUserId: userId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                assignmentBatch: {
                    raterGroupId: id
                }
            }
        });

        if (pendingAssignments > 0) {
            return NextResponse.json({
                error: `Cannot remove member with ${pendingAssignments} pending assignment(s)`
            }, { status: 409 });
        }

        await prisma.raterGroupMember.delete({
            where: { id: membership.id }
        });

        await logAudit({
            action: 'RATER_GROUP_MEMBER_REMOVED',
            entityType: 'RATER_GROUP',
            entityId: id,
            projectId: membership.raterGroup.projectId,
            userId: user.id,
            userEmail: user.email!,
            metadata: {
                removedUserId: userId,
                removedUserEmail: membership.user.email,
                groupName: membership.raterGroup.name
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing member:', error);
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }
}
