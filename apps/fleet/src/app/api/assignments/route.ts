import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments
 * List assignment batches (filterable by project, status, group)
 */
export async function GET(request: NextRequest) {
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

    if (!profile || !['ADMIN', 'FLEET'].includes((profile as any)?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get('projectId');
        const status = searchParams.get('status');
        const raterGroupId = searchParams.get('raterGroupId');
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: any = {};

        if (projectId) {
            where.projectId = projectId;
        }

        if (status) {
            where.status = status;
        }

        if (raterGroupId) {
            where.raterGroupId = raterGroupId;
        }

        const batches = await prisma.assignmentBatch.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
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
                _count: {
                    select: { records: true }
                }
            }
        });

        return NextResponse.json({ batches });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }
}

/**
 * POST /api/assignments
 * Create a new assignment batch
 */
export async function POST(request: NextRequest) {
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
    if (!['ADMIN', 'FLEET'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const {
            projectId,
            name,
            description,
            raterGroupId,
            assignedToUserId,
            recordIds,
            criteria,
            dueDate
        } = body;

        // Validation
        if (!projectId || !name?.trim()) {
            return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
        }

        if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
            return NextResponse.json({ error: 'recordIds array is required' }, { status: 400 });
        }

        if (!raterGroupId && !assignedToUserId) {
            return NextResponse.json({ error: 'Either raterGroupId or assignedToUserId is required' }, { status: 400 });
        }

        if (raterGroupId && assignedToUserId) {
            return NextResponse.json({ error: 'Cannot assign to both group and individual' }, { status: 400 });
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Verify records exist and belong to the project
        const records = await prisma.dataRecord.findMany({
            where: {
                id: { in: recordIds },
                projectId
            },
            select: { id: true }
        });

        if (records.length !== recordIds.length) {
            return NextResponse.json({ error: 'Some records not found or not in this project' }, { status: 404 });
        }

        // If assigning to group, verify it exists
        if (raterGroupId) {
            const group = await prisma.raterGroup.findUnique({
                where: { id: raterGroupId },
                select: { id: true, projectId: true }
            });

            if (!group) {
                return NextResponse.json({ error: 'Rater group not found' }, { status: 404 });
            }

            if (group.projectId !== projectId) {
                return NextResponse.json({ error: 'Rater group does not belong to this project' }, { status: 400 });
            }
        }

        // If assigning to individual, verify they exist
        if (assignedToUserId) {
            const assignee = await prisma.profile.findUnique({
                where: { id: assignedToUserId },
                select: { id: true }
            });

            if (!assignee) {
                return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 });
            }
        }

        // Create the batch with records in a transaction
        const batch = await prisma.$transaction(async (tx) => {
            const newBatch = await tx.assignmentBatch.create({
                data: {
                    projectId,
                    name: name.trim(),
                    description: description?.trim() || null,
                    raterGroupId: raterGroupId || null,
                    assignedToUserId: assignedToUserId || null,
                    criteria: criteria || null,
                    totalRecords: recordIds.length,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    createdById: user.id
                }
            });

            // Create assignment records
            await tx.assignmentRecord.createMany({
                data: recordIds.map((recordId: string) => ({
                    assignmentBatchId: newBatch.id,
                    recordId,
                    // If assigned to individual, set on each record too
                    assignedToUserId: assignedToUserId || null
                }))
            });

            return newBatch;
        });

        await logAudit({
            action: 'ASSIGNMENT_BATCH_CREATED',
            entityType: 'ASSIGNMENT_BATCH',
            entityId: batch.id,
            projectId,
            userId: user.id,
            userEmail: user.email!,
            metadata: {
                name: batch.name,
                recordCount: recordIds.length,
                raterGroupId,
                assignedToUserId
            }
        });

        // Fetch full batch for response
        const fullBatch = await prisma.assignmentBatch.findUnique({
            where: { id: batch.id },
            include: {
                raterGroup: { select: { id: true, name: true } },
                assignedToUser: { select: { id: true, email: true } },
                _count: { select: { records: true } }
            }
        });

        return NextResponse.json({ batch: fullBatch }, { status: 201 });
    } catch (error) {
        console.error('Error creating assignment batch:', error);
        return NextResponse.json({ error: 'Failed to create assignment batch' }, { status: 500 });
    }
}
