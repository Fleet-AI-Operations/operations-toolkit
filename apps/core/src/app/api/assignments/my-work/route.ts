import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments/my-work
 * Get the current user's assigned work
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status'); // PENDING, IN_PROGRESS, COMPLETED
        const projectId = searchParams.get('projectId');

        // Find batches where user is:
        // 1. Directly assigned (assignedToUserId)
        // 2. Member of the assigned group
        // 3. Has individual record assignments

        // Get groups the user is a member of
        const memberships = await prisma.raterGroupMember.findMany({
            where: { userId: user.id },
            select: { raterGroupId: true }
        });
        const groupIds = memberships.map(m => m.raterGroupId);

        // Build the query
        const batchWhere: any = {
            OR: [
                { assignedToUserId: user.id },
                { raterGroupId: { in: groupIds } },
                {
                    records: {
                        some: { assignedToUserId: user.id }
                    }
                }
            ],
            status: { not: 'CANCELLED' }
        };

        if (projectId) {
            batchWhere.projectId = projectId;
        }

        if (status) {
            batchWhere.status = status;
        }

        const batches = await prisma.assignmentBatch.findMany({
            where: batchWhere,
            orderBy: [
                { dueDate: 'asc' },
                { createdAt: 'desc' }
            ],
            include: {
                project: {
                    select: { id: true, name: true }
                },
                raterGroup: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { records: true }
                }
            }
        });

        // For each batch, calculate user's specific progress
        const batchesWithProgress = await Promise.all(
            batches.map(async (batch) => {
                // Get user's records in this batch
                const recordWhere: any = {
                    assignmentBatchId: batch.id
                };

                // If batch is assigned to individual or user has specific records
                if (batch.assignedToUserId === user.id) {
                    // All records are the user's
                } else if (groupIds.includes(batch.raterGroupId || '')) {
                    // User is in the group - get their assigned records
                    recordWhere.assignedToUserId = user.id;
                } else {
                    // User has specific record assignments
                    recordWhere.assignedToUserId = user.id;
                }

                const [total, completed, inProgress] = await Promise.all([
                    prisma.assignmentRecord.count({ where: recordWhere }),
                    prisma.assignmentRecord.count({
                        where: { ...recordWhere, status: 'COMPLETED' }
                    }),
                    prisma.assignmentRecord.count({
                        where: { ...recordWhere, status: 'IN_PROGRESS' }
                    })
                ]);

                return {
                    ...batch,
                    userProgress: {
                        total,
                        completed,
                        inProgress,
                        pending: total - completed - inProgress
                    }
                };
            })
        );

        // Filter out batches where user has no assigned work
        const relevantBatches = batchesWithProgress.filter(b => b.userProgress.total > 0);

        return NextResponse.json({ batches: relevantBatches });
    } catch (error) {
        console.error('Error fetching my work:', error);
        return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }
}
