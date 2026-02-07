import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DatabaseQueue } from '@/lib/queue/db-queue';
import { RecordType } from '@prisma/client';

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

        const { url, projectId, type, filterKeywords, generateEmbeddings, records } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        if (!records || !Array.isArray(records)) {
            return NextResponse.json({ error: 'Records array is required' }, { status: 400 });
        }

        if (records.length === 0) {
            return NextResponse.json({ error: 'No records provided' }, { status: 400 });
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

        // Validate record type
        const recordType = type as RecordType || 'TASK';
        if (!['TASK', 'FEEDBACK'].includes(recordType)) {
            return NextResponse.json({ error: 'Invalid type. Must be TASK or FEEDBACK' }, { status: 400 });
        }

        // Create IngestJob record
        const ingestJob = await prisma.ingestJob.create({
            data: {
                projectId,
                type: recordType,
                status: 'PENDING',
                totalRecords: records.length,
                options: {
                    source: url ? `api:${url}` : 'api',
                    filterKeywords,
                    generateEmbeddings: generateEmbeddings ?? true,
                },
            },
        });

        // Enqueue job for processing by worker
        await DatabaseQueue.enqueue({
            jobType: 'INGEST_DATA',
            payload: {
                ingestJobId: ingestJob.id,
                projectId,
                records,
                generateEmbeddings: generateEmbeddings ?? true,
                source: url ? `api:${url}` : 'api',
            },
            priority: 1, // Higher priority for API ingestion
        });

        return NextResponse.json({
            message: 'Ingestion queued for processing. Workers will process this shortly.',
            jobId: ingestJob.id,
        });
    } catch (error: any) {
        console.error('API Ingestion Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
