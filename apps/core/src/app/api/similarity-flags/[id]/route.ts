import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CORE', 'FLEET', 'MANAGER', 'ADMIN'];

/**
 * PATCH /api/similarity-flags/:id
 * Body: { action: 'claim' }
 * Claims an OPEN flag — sets status to CLAIMED and records who claimed it.
 * Auth: CORE or higher role required.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        if (body.action !== 'claim') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const updated = await prisma.$queryRaw<{ id: string; status: string; claimed_by_email: string | null; claimed_at: Date }[]>`
            UPDATE public.similarity_flags
            SET status = 'CLAIMED',
                claimed_by_email = ${user.email ?? null},
                claimed_at = NOW()
            WHERE id = ${id}::uuid
              AND status = 'OPEN'
            RETURNING id, status, claimed_by_email, claimed_at
        `;

        if (updated.length === 0) {
            // Either not found or already claimed
            return NextResponse.json({ error: 'Flag not found or already claimed' }, { status: 409 });
        }

        return NextResponse.json({
            id: updated[0].id,
            status: updated[0].status,
            claimedByEmail: updated[0].claimed_by_email,
            claimedAt: updated[0].claimed_at,
        });
    } catch (error: any) {
        console.error('[similarity-flags PATCH] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
