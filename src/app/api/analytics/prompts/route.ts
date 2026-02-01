import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const userId = searchParams.get('userId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Verify project exists (read access allowed for all users)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const whereClause: any = {
            projectId,
            type: 'TASK',
            createdById: { not: null },
        };

        if (userId && userId !== 'All') {
            whereClause.createdById = userId;
        }

        const prompts = await prisma.dataRecord.findMany({
            where: whereClause,
            select: {
                id: true,
                content: true,
                category: true,
                createdByEmail: true,
                createdByName: true,
                createdById: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const uniqueUsers = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK',
                createdById: { not: null }
            },
            select: {
                createdByEmail: true,
                createdByName: true,
                createdById: true,
            },
            distinct: ['createdById'],
        });

        return NextResponse.json({
            prompts,
            users: uniqueUsers.map(u => ({
                id: u.createdById!,
                name: u.createdByName || u.createdByEmail || 'Unknown',
            })),
        });
    } catch (error: any) {
        console.error('Error fetching prompts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch prompts', details: error.message },
            { status: 500 }
        );
    }
}
