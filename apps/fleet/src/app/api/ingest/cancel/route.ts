import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireRole } from '@repo/api-utils';
import { logAudit } from '@repo/core/audit';

/**
 * CANCEL INGESTION JOB
 * Marks a job as 'CANCELLED'. The background worker checks this status
 * every 25 records and will abort if it detects the change.
 */
export async function POST(req: NextRequest) {
    const authResult = await requireRole(req, ['FLEET', 'ADMIN']);
    if (authResult.error) return authResult.error;

    try {
        const { jobId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await prisma.ingestJob.update({
            where: { id: jobId },
            data: {
                status: 'CANCELLED',
                error: 'Stopped by user'
            }
        });

        logAudit({
            action: 'DATA_INGESTION_CANCELLED',
            entityType: 'INGEST_JOB',
            entityId: jobId,
            userId: authResult.user!.id,
            userEmail: authResult.user!.email,
        }).catch(err => console.error('[Cancel Ingest] Audit log failed:', err));

        return NextResponse.json({ success: true, status: job.status });
    } catch (error: any) {
        console.error('Cancel Job Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
