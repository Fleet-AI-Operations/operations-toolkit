import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { processQueuedJobs } from '@repo/core/ingestion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    try {
        const jobId = req.nextUrl.searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await prisma.ingestJob.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // SERVERLESS FIX: Trigger processing on status check
        // This ensures jobs actually get processed even if the initial trigger was killed
        // IMPORTANT: Must await in serverless - there is no "background" after response is sent
        if (job.status === 'PENDING' || job.status === 'QUEUED_FOR_VEC') {
            await processQueuedJobs(job.projectId).catch(err =>
                console.error('Queue Processor Error:', err)
            );

            // Refetch job to get updated status
            const updatedJob = await prisma.ingestJob.findUnique({
                where: { id: jobId },
            });
            return NextResponse.json(updatedJob || job);
        }

        return NextResponse.json(job);
    } catch (error: any) {
        console.error('Job Status Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
