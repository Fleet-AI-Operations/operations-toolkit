import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const allowedRoles = ['FLEET', 'MANAGER', 'ADMIN'];
    if (!profile || !allowedRoles.includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const environment = req.nextUrl.searchParams.get('environment');

        // Fetch recent jobs (optionally filter by environment)
        const where = environment ? { environment } : {};

        const jobs = await prisma.ingestJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 20 // Show more jobs since we're showing all environments
        });

        return NextResponse.json(jobs);
    } catch (error) {
        console.error('Fetch Jobs Error:', error);
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
}
