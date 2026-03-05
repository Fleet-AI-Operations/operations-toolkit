import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

async function requireFleetAuth(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[DailyGreatTasks] Failed to fetch profile for user', user.id, profileError);
        return { error: NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }) };
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user, profile };
}

/**
 * PATCH /api/daily-great-tasks/[id]
 * Body: { isDailyGreat: boolean }
 * Sets is_daily_great on a data_record.
 * Auth: FLEET+
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireFleetAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    let body: { isDailyGreat?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    try {
        const { isDailyGreat } = body;

        if (typeof isDailyGreat !== 'boolean') {
            return NextResponse.json({ error: 'isDailyGreat must be a boolean' }, { status: 400 });
        }

        // Verify the record exists and is a TASK
        const existing = await prisma.dataRecord.findUnique({
            where: { id },
            select: { id: true, type: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        if (existing.type !== 'TASK') {
            return NextResponse.json({ error: 'Only TASK records can be flagged as daily great' }, { status: 400 });
        }

        await prisma.$executeRaw`
            UPDATE public.data_records
            SET is_daily_great = ${isDailyGreat}
            WHERE id = ${id}
        `;

        return NextResponse.json({ id, isDailyGreat });
    } catch (err) {
        console.error('[DailyGreatTasks] PATCH error:', err);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}
