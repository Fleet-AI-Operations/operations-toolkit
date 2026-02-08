import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/assignments/[id]/distribute
 * Auto-distribute records among group members
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
        // Get the batch with its group and records
        const batch = await prisma.assignmentBatch.findUnique({
            where: { id },
            include: {
                raterGroup: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: { id: true, email: true }
                                }
                            }
                        }
                    }
                },
                records: {
                    where: {
                        assignedToUserId: null,
                        status: 'PENDING'
                    },
                    select: { id: true }
                }
            }
        });

        if (!batch) {
            return NextResponse.json({ error: 'Assignment batch not found' }, { status: 404 });
        }

        if (!batch.raterGroupId || !batch.raterGroup) {
            return NextResponse.json({
                error: 'This batch is not assigned to a group. Distribution only works for group assignments.'
            }, { status: 400 });
        }

        const members = batch.raterGroup.members;
        if (members.length === 0) {
            return NextResponse.json({
                error: 'No members in the rater group'
            }, { status: 400 });
        }

        const unassignedRecords = batch.records;
        if (unassignedRecords.length === 0) {
            return NextResponse.json({
                message: 'No unassigned records to distribute',
                distributed: 0
            });
        }

        // Distribute records evenly among members
        const assignments: { recordId: string; userId: string }[] = [];
        let memberIndex = 0;

        for (const record of unassignedRecords) {
            assignments.push({
                recordId: record.id,
                userId: members[memberIndex].userId
            });
            memberIndex = (memberIndex + 1) % members.length;
        }

        // Update records in bulk using the assignment array
        await prisma.$transaction(
            assignments.map(a =>
                prisma.assignmentRecord.updateMany({
                    where: {
                        assignmentBatchId: id,
                        recordId: a.recordId
                    },
                    data: {
                        assignedToUserId: a.userId
                    }
                })
            )
        );

        await logAudit({
            action: 'ASSIGNMENT_BATCH_DISTRIBUTED',
            entityType: 'ASSIGNMENT_BATCH',
            entityId: id,
            projectId: batch.projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: {
                distributedCount: unassignedRecords.length,
                memberCount: members.length
            }
        });

        // Calculate distribution summary
        const distribution: Record<string, number> = {};
        for (let i = 0; i < unassignedRecords.length; i++) {
            const email = members[i % members.length].user.email;
            distribution[email] = (distribution[email] || 0) + 1;
        }

        return NextResponse.json({
            success: true,
            distributed: unassignedRecords.length,
            distribution
        });
    } catch (error) {
        console.error('Error distributing assignments:', error);
        return NextResponse.json({ error: 'Failed to distribute assignments' }, { status: 500 });
    }
}
