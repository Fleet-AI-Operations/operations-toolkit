import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@/lib/ingestion';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

        const { url, projectId, type, filterKeywords, generateEmbeddings } = await req.json();

        if (!url || !projectId) {
            return NextResponse.json({ error: 'URL and Project ID are required' }, { status: 400 });
        }

        // Verify user owns the project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'ADMIN' && project.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
        }

        const jobId = await startBackgroundIngest('API', url, {
            projectId,
            source: `api:${url}`,
            type,
            filterKeywords,
            generateEmbeddings,
        });

        return NextResponse.json({
            message: `Ingestion started in the background.`,
            jobId
        });
    } catch (error: any) {
        console.error('API Ingestion Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
