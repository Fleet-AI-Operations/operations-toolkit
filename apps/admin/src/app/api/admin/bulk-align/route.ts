import { NextRequest, NextResponse } from 'next/server';
import { startBulkAlignment } from '@repo/core/analytics';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';
import { requireAdminRole } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const { environment } = await req.json();

        if (!environment) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const jobId = await startBulkAlignment(environment);

        if (!jobId) {
            return NextResponse.json({ message: 'No records to analyze.' });
        }

        // Log audit event (non-critical)
        await logAudit({
            action: 'BULK_ALIGNMENT_STARTED',
            entityType: 'DATA_RECORD',
            userId: user.id,
            userEmail: user.email!,
            metadata: { environment, jobId }
        });

        return NextResponse.json({ success: true, jobId });
    } catch (error: any) {
        console.error('Bulk Align API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;

    try {
        const environment = req.nextUrl.searchParams.get('environment');

        if (!environment) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const jobs = await prisma.analyticsJob.findMany({
            where: { environment },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error('Fetch Analytics Jobs Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
