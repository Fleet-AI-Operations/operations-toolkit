import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, checkAuditResult } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const authResult = await requireAuth();
        if ('error' in authResult) return authResult.error;

        // All authenticated users can read all projects
        const projects = await prisma.project.findMany({
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ projects });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const authResult = await requireRole('FLEET');
        if ('error' in authResult) return authResult.error;
        const { user } = authResult;

        const { name } = await req.json();
        const project = await prisma.project.create({
            data: {
                name,
                ownerId: user.id
            },
        });

        // Log audit event (non-critical)
        await logAudit({
            action: 'PROJECT_CREATED',
            entityType: 'PROJECT',
            entityId: project.id,
            projectId: project.id,
            userId: user.id,
            userEmail: user.email,
            metadata: { name }
        });

        return NextResponse.json({ project });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const authResult = await requireRole('FLEET');
        if ('error' in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        await prisma.project.delete({
            where: { id },
        });

        // Log audit event (critical operation)
        const auditResult = await logAudit({
            action: 'PROJECT_DELETED',
            entityType: 'PROJECT',
            entityId: id,
            projectId: id,
            userId: user.id,
            userEmail: user.email,
            metadata: {}
        });

        checkAuditResult(auditResult, 'PROJECT_DELETED', {
            entityId: id,
            userId: user.id
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const authResult = await requireRole('FLEET');
        if ('error' in authResult) return authResult.error;
        const { user } = authResult;

        const { id, guidelines, guidelinesFileName } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const existingProject = await prisma.project.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!existingProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = await prisma.project.update({
            where: { id },
            data: {
                guidelines,
                guidelinesFileName
            },
        });

        // Log audit event (non-critical)
        await logAudit({
            action: 'PROJECT_UPDATED',
            entityType: 'PROJECT',
            entityId: id,
            projectId: id,
            userId: user.id,
            userEmail: user.email,
            metadata: { guidelinesFileName }
        });

        return NextResponse.json({ project });
    } catch (error: any) {
        console.error('Project PATCH Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
