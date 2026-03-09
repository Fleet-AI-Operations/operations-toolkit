import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@repo/database';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Delete one batch of duplicate records per call. Returns { deleted, remaining, done }.
// The frontend loops until done=true, accumulating deleted counts for progress display.
// Batch size is conservative to stay well within the 30s default Vercel timeout.
const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;

    try {
        // Pick the next batch of IDs from the staging table
        const batch = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM public._duplicates_to_delete LIMIT ${BATCH_SIZE}
        `;

        if (batch.length === 0) {
            return NextResponse.json({ deleted: 0, remaining: 0, done: true });
        }

        const ids = batch.map(r => r.id);

        // Delete LikertScores and DataRecords, then remove from the staging table —
        // all in one transaction so a mid-batch crash cannot leave staging entries
        // pointing at already-deleted records.
        await prisma.$transaction(async (tx) => {
            await tx.likertScore.deleteMany({ where: { recordId: { in: ids } } });
            await tx.dataRecord.deleteMany({ where: { id: { in: ids } } });
            await tx.$executeRaw`
                DELETE FROM public._duplicates_to_delete
                WHERE id IN (${Prisma.join(ids)})
            `;
        });

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
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
