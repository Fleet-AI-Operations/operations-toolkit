import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireAdminRole } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;

    try {
        const { jobId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await prisma.analyticsJob.update({
            where: { id: jobId },
            data: {
                status: 'CANCELLED',
                error: 'Stopped by admin'
            }
        });

        return NextResponse.json({ success: true, status: job.status });
    } catch (error: any) {
        console.error('Cancel Analytics Job Error:', error);
        return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }
}
