import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundIngest } from '@repo/core/ingestion';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        const { url, environment, type, filterKeywords, generateEmbeddings } = await req.json();

        if (!url || !environment) {
            return NextResponse.json({ error: 'URL and Environment are required' }, { status: 400 });
        }

        // Authorization: Only FLEET and ADMIN roles can ingest data
        if (role !== 'ADMIN' && role !== 'FLEET') {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const { jobId } = await startBackgroundIngest('API', url, {
            environment,
            source: `api:${url}`,
            type,
            filterKeywords,
            generateEmbeddings,
        });

        // Processing is triggered by the Supabase DB webhook on ingest_jobs INSERT.
        return NextResponse.json({
            message: `Ingestion started in the background.`,
            jobId
        });
    } catch (error: any) {
        console.error('API Ingestion Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
