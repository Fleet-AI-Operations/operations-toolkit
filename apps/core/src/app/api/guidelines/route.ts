import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/guidelines
 *
 * Returns all available guideline summaries (no PDF content) for use in the
 * guideline selection modal on the Alignment Scoring page.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true },
    });

    if (!profile || !['CORE', 'FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const guidelines = await prisma.guideline.findMany({
            select: { id: true, name: true, environments: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ guidelines });
    } catch (err) {
        console.error('Guidelines API Error: Failed to fetch guidelines', err);
        return NextResponse.json({ error: 'Failed to load guidelines' }, { status: 500 });
    }
}
