import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@/lib/ingestion';
import { RecordType, RecordCategory } from '@prisma/client';
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

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;
        const type = formData.get('type') as RecordType;
        const filterKeywords = formData.get('filterKeywords')?.toString().split(',').map(s => s.trim()).filter(Boolean);
        const generateEmbeddings = formData.get('generateEmbeddings') === 'true';

        if (!file || !projectId) {
            return NextResponse.json({ error: 'File and Project ID are required' }, { status: 400 });
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

        const csvContent = await file.text();
        const jobId = await startBackgroundIngest('CSV', csvContent, {
            projectId,
            source: `csv:${file.name}`,
            type,
            filterKeywords,
            generateEmbeddings,
        });

        return NextResponse.json({
            message: `Ingestion started in the background.`,
            jobId
        });
    } catch (error: any) {
        console.error('CSV Ingestion Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
