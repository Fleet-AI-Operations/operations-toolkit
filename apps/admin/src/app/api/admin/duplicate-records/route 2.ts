import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[duplicate-records] Failed to fetch profile:', profileError);
        return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    if ((profile as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
