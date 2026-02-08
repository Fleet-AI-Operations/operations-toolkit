import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rater-groups
 * List rater groups for a project
 */
export async function GET(request: NextRequest) {
    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const groups = await prisma.raterGroup.findMany({
            where: { projectId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        members: true,
                        assignments: true
                    }
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({ groups });
    } catch (error) {
        console.error('Error fetching rater groups:', error);
        return NextResponse.json({ error: 'Failed to fetch rater groups' }, { status: 500 });
    }
}

/**
 * POST /api/rater-groups
 * Create a new rater group
 */
export async function POST(request: NextRequest) {
    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const body = await request.json();
        const { projectId, name, description } = body;

        if (!projectId || !name?.trim()) {
            return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
        }

        // Check project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Check for duplicate name in project
        const existing = await prisma.raterGroup.findFirst({
            where: { projectId, name: name.trim() }
        });

        if (existing) {
            return NextResponse.json({ error: 'A group with this name already exists in this project' }, { status: 409 });
        }

        const group = await prisma.raterGroup.create({
            data: {
                projectId,
                name: name.trim(),
                description: description?.trim() || null
            },
            include: {
                _count: {
                    select: { members: true, assignments: true }
                }
            }
        });

        await logAudit({
            action: 'RATER_GROUP_CREATED',
            entityType: 'RATER_GROUP',
            entityId: group.id,
            projectId,
            userId: user.id,
            userEmail: user.email,
            metadata: { name: group.name }
        });

        return NextResponse.json({ group }, { status: 201 });
    } catch (error) {
        console.error('Error creating rater group:', error);
        return NextResponse.json({ error: 'Failed to create rater group' }, { status: 500 });
    }
}
