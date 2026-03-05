import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

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

        return NextResponse.json(job);
    } catch (error: any) {
        console.error('Job Status Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
