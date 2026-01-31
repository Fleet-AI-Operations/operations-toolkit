import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

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
        const { jobId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await prisma.analyticsJob.update({
            where: { id: jobId },
            data: {
                status: 'CANCELLED',
                error: 'Stopped by admin'
            }
        });

        return NextResponse.json({ success: true, status: job.status });
    } catch (error: any) {
        console.error('Cancel Analytics Job Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
