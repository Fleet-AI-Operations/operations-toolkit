import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@repo/core/ingestion';
import { RecordType } from '@prisma/client';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Size limit for direct upload (increased for local development)
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
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
        const filterKeywords = formData.get('filterKeywords')?.toString().split(',').map(s => s.trim()).filter(Boolean);
        const generateEmbeddings = formData.get('generateEmbeddings') === 'true';

        // Validation: Required fields
        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
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

        // Authorization: Only FLEET and ADMIN roles can ingest data
        if (role !== 'ADMIN' && role !== 'FLEET') {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        // Read file content
        const csvContent = await file.text();

        // Basic CSV validation - check for content
        if (!csvContent.trim()) {
            return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
        }

        const { jobId } = await startBackgroundIngest('CSV', csvContent, {
            source: `csv:${file.name}`,
            filterKeywords,
            generateEmbeddings,
        });

        // Processing is triggered by the Supabase DB webhook on ingest_jobs INSERT.
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
