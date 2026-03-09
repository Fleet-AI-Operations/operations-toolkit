import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;

    try {
        const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) AS count FROM public._duplicates_to_delete
        `;
        return NextResponse.json({ count: Number(result[0].count) });
    } catch (error: any) {
        // PG error code 42P01 = relation does not exist (migration not yet applied)
        if (error?.meta?.code === '42P01') {
            return NextResponse.json({ count: 0 });
        }
        console.error('[duplicate-records] Failed to query duplicate count:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
