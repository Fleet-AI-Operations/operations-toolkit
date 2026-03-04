import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CORE', 'FLEET', 'MANAGER', 'ADMIN'];

/**
 * GET /api/similarity-jobs?environment=X
 * Returns similarity jobs (most recent first).
 * Auth: CORE or higher role required.
 */
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const environment = searchParams.get('environment') || null;

        let jobs: Array<{
            id: string;
            ingest_job_id: string;
            environment: string;
            status: string;
            records_checked: number;
            flags_found: number;
            error: string | null;
            created_at: Date;
            updated_at: Date;
        }>;

        if (environment) {
            jobs = await prisma.$queryRaw`
                SELECT id, ingest_job_id, environment, status, records_checked, flags_found, error, created_at, updated_at
                FROM public.similarity_jobs
                WHERE environment = ${environment}
                ORDER BY created_at DESC
                LIMIT 100
            `;
        } else {
            jobs = await prisma.$queryRaw`
                SELECT id, ingest_job_id, environment, status, records_checked, flags_found, error, created_at, updated_at
                FROM public.similarity_jobs
                ORDER BY created_at DESC
                LIMIT 100
            `;
        }

        return NextResponse.json({
            jobs: jobs.map(j => ({
                id: j.id,
                ingestJobId: j.ingest_job_id,
                environment: j.environment,
                status: j.status,
                recordsChecked: Number(j.records_checked),
                flagsFound: Number(j.flags_found),
                error: j.error,
                createdAt: j.created_at,
                updatedAt: j.updated_at,
            }))
        });
    } catch (error: any) {
        console.error('[similarity-jobs] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
