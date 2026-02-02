import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { logAudit, checkAuditResult } from '@/lib/audit';

export const dynamic = 'force-dynamic';

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
        const { target } = await req.json();

        if (target === 'ALL_DATA') {
            // Delete all records and reset project analysis
            await prisma.$transaction([
                prisma.dataRecord.deleteMany({}),
                prisma.project.updateMany({
                    data: {
                        lastTaskAnalysis: null,
                        lastFeedbackAnalysis: null
                    }
                })
            ]);

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'DATA_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email!,
                metadata: { target: 'ALL_DATA' }
            });

            checkAuditResult(auditResult, 'DATA_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All record data and analytics cleared successfully.' });
        }

        if (target === 'ANALYTICS_ONLY') {
            // Reset project analysis only
            await prisma.project.updateMany({
                data: {
                    lastTaskAnalysis: null,
                    lastFeedbackAnalysis: null
                }
            });

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'ANALYTICS_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email!,
                metadata: { target: 'ANALYTICS_ONLY' }
            });

            checkAuditResult(auditResult, 'ANALYTICS_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All saved analytics cleared successfully.' });
        }

        return NextResponse.json({ error: 'Invalid clear target' }, { status: 400 });
    } catch (error: any) {
        console.error('Admin Clear API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
