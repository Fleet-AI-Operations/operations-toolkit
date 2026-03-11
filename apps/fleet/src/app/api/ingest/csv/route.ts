import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@repo/core/ingestion';
import { RecordType } from '@prisma/client';
import { requireRole } from '@repo/api-utils';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Size limit for direct upload (increased for local development)
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const VALID_TYPES: RecordType[] = ['TASK', 'FEEDBACK'];

export async function POST(req: NextRequest) {
    try {
        const authResult = await requireRole(req, ['FLEET', 'ADMIN']);
        if (authResult.error) return authResult.error;

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

        logAudit({
            action: 'DATA_INGESTION_STARTED',
            entityType: 'INGEST_JOB',
            entityId: jobId,
            userId: authResult.user!.id,
            userEmail: authResult.user!.email ?? 'unknown',
            metadata: { source: `csv:${file.name}`, fileSizeBytes: file.size, generateEmbeddings: generateEmbeddings ?? false },
        }).catch(err => console.error('[CSV Ingest] Audit log failed:', err));

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
