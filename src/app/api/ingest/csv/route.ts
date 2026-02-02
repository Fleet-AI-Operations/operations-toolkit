import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@/lib/ingestion';
import { RecordType } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Size limit for direct upload (use chunked upload for larger files)
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (leaves room for Vercel's 4.5MB limit)
const VALID_TYPES: RecordType[] = ['TASK', 'FEEDBACK'];

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
        const file = formData.get('file') as File | null;
        const projectId = formData.get('projectId') as string | null;
        const type = formData.get('type') as string | null;
        const filterKeywords = formData.get('filterKeywords')?.toString().split(',').map(s => s.trim()).filter(Boolean);
        const generateEmbeddings = formData.get('generateEmbeddings') === 'true';

        // Validation: Required fields
        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }
        if (!projectId || typeof projectId !== 'string') {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Validation: File type (check extension - MIME types are unreliable for CSV)
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.csv')) {
            return NextResponse.json({
                error: 'Invalid file type. Only CSV files are accepted.'
            }, { status: 400 });
        }

        // Validation: File size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Use chunked upload for files over ${MAX_FILE_SIZE / 1024 / 1024}MB.`
            }, { status: 413 });
        }

        // Validation: Record type
        if (!type || !VALID_TYPES.includes(type as RecordType)) {
            return NextResponse.json({
                error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`
            }, { status: 400 });
        }

        // Validation: Project exists and user has access
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, ownerId: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'ADMIN' && project.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
        }

        // Read file content
        const csvContent = await file.text();

        // Basic CSV validation - check for content
        if (!csvContent.trim()) {
            return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
        }

        // Start background ingestion
        const jobId = await startBackgroundIngest('CSV', csvContent, {
            projectId,
            source: `csv:${file.name}`,
            type: type as RecordType,
            filterKeywords,
            generateEmbeddings,
        });

        return NextResponse.json({
            message: 'Ingestion started in the background.',
            jobId
        });
    } catch (error: unknown) {
        console.error('CSV Ingestion Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
