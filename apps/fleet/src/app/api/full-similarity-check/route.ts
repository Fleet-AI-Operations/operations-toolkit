import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user has FLEET or higher role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !['FLEET', 'ADMIN'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Fetch tasks for the specified project
        const tasks = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK'
            },
            select: {
                id: true,
                content: true,
                metadata: true,
                createdByName: true,
                createdByEmail: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format the response to extract environment from metadata
        const formattedTasks = tasks.map(task => ({
            id: task.id,
            content: task.content,
            environment: (task.metadata as any)?.environment_name || 'N/A',
            createdBy: task.createdByName || task.createdByEmail || 'Unknown',
            createdAt: task.createdAt,
        }));

        return NextResponse.json({ tasks: formattedTasks });
    } catch (error: any) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
