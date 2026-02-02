import { NextRequest, NextResponse } from 'next/server';
import { startBulkAlignment } from '@/lib/analytics';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

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
        const { projectId } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const jobId = await startBulkAlignment(projectId);

        if (!jobId) {
            return NextResponse.json({ message: 'No records to analyze.' });
        }

        // Log audit event (non-critical)
        await logAudit({
            action: 'BULK_ALIGNMENT_STARTED',
            entityType: 'DATA_RECORD',
            projectId,
            userId: user.id,
            userEmail: user.email!,
            metadata: { jobId }
        });

        return NextResponse.json({ success: true, jobId });
    } catch (error: any) {
        console.error('Bulk Align API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
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
        const projectId = req.nextUrl.searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const jobs = await prisma.analyticsJob.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error('Fetch Analytics Jobs Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
