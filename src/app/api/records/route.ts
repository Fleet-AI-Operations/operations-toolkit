import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findSimilarRecords } from '@/lib/similarity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');

    try {
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (type) where.type = type;
        if (category) where.category = category;

        const records = await prisma.dataRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });

        const total = await prisma.dataRecord.count({ where });

        return NextResponse.json({ records, total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { action, targetId, limit } = await req.json();

        if (action === 'similarity') {
            if (!targetId) {
                return NextResponse.json({ error: 'Target ID required' }, { status: 400 });
            }
            const results = await findSimilarRecords(targetId, limit || 5);
            return NextResponse.json({ results });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
