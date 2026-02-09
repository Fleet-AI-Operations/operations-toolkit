import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const projectId = req.nextUrl.searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Fetch recent jobs for this project (last 5)
        const jobs = await prisma.ingestJob.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error('Fetch Jobs Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
