import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

// Delete one batch of duplicate records per call. The frontend loops until done=true.
// Batch size is conservative to stay well within the 30s default Vercel timeout.
const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if ((profile as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // Pick the next batch of IDs from the staging table
        const batch = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM public._duplicates_to_delete LIMIT ${BATCH_SIZE}
        `;

        if (batch.length === 0) {
            return NextResponse.json({ deleted: 0, remaining: 0, done: true });
        }

        const ids = batch.map(r => r.id);

        // Delete dependent LikertScores first, then the DataRecords themselves
        await prisma.$transaction([
            prisma.likertScore.deleteMany({ where: { recordId: { in: ids } } }),
            prisma.dataRecord.deleteMany({ where: { id: { in: ids } } }),
        ]);

        // Remove the processed IDs from the staging table
        await prisma.$executeRaw`
            DELETE FROM public._duplicates_to_delete
            WHERE id = ANY(${ids}::text[])
        `;

        const remaining = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) AS count FROM public._duplicates_to_delete
        `;
        const remainingCount = Number(remaining[0].count);

        return NextResponse.json({
            deleted: ids.length,
            remaining: remainingCount,
            done: remainingCount === 0,
        });
    } catch (error: any) {
        console.error('[duplicate-records/delete] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
