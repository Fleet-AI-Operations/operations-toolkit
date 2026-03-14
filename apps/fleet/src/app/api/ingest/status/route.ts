import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireRole } from '@repo/api-utils';

export const dynamic = 'force-dynamic';

// Must be > maxDuration of the process-job webhook handler (300s) to avoid false positives.
const ZOMBIE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
    const authResult = await requireRole(req, ['FLEET', 'ADMIN']);
    if (authResult.error) return authResult.error;

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

        // ZOMBIE DETECTION: Jobs stuck in PROCESSING or VECTORIZING beyond the webhook
        // handler's maxDuration are assumed to have been killed by a Vercel timeout.
        // Mark them FAILED so the UI surfaces an error rather than spinning forever.
        // Vectorization failures can be restarted via the retroactive-vectorization endpoint.
        if (job.status === 'PROCESSING' || job.status === 'VECTORIZING') {
            const staleSinceMs = Date.now() - new Date(job.updatedAt).getTime();
            if (staleSinceMs > ZOMBIE_THRESHOLD_MS) {
                const isVectorizing = job.status === 'VECTORIZING';
                const { count } = await prisma.ingestJob.updateMany({
                    where: { id: jobId, status: job.status },
                    data: {
                        status: 'FAILED',
                        error: isVectorizing
                            ? 'Vectorization timed out. Use retroactive vectorization to resume.'
                            : 'Ingestion timed out. Please re-upload the file.',
                    },
                });

                if (count > 0) {
                    console.warn(`[Status] Job ${jobId} zombie-failed after ${Math.round(staleSinceMs / 1000)}s stuck in ${job.status}`);
                }

                const updatedJob = await prisma.ingestJob.findUnique({ where: { id: jobId } });
                return NextResponse.json(updatedJob || job);
            }
        }

        return NextResponse.json(job);
    } catch (error) {
        console.error('Job Status Error:', error);
        return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
    }
}
