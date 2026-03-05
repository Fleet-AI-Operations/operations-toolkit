import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { runPhase1, runPhase2 } from '@repo/core/ingestion';

export const dynamic = 'force-dynamic';

// Allow up to 5 minutes for Phase 1 + Phase 2 to complete.
// Vercel Pro supports up to 300s; increase to 900s on Enterprise if needed.
export const maxDuration = 300;

/**
 * POST /api/ingest/process-job
 *
 * Webhook receiver called by a Supabase DB trigger (via pg_net) whenever a row
 * is inserted into public.ingest_jobs.
 *
 * The trigger fires synchronously on INSERT but pg_net delivers the HTTP request
 * asynchronously, so this endpoint responds immediately and uses waitUntil to
 * run the actual processing after the response is sent.
 *
 * Payload (set by the DB trigger):
 *   { job_id: string, environment: string, status: string }
 *
 * Security: requests must include the x-webhook-secret header matching WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-webhook-secret');
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job_id, environment, status } = body;

    if (!job_id || !environment) {
        return NextResponse.json({ error: 'Missing job_id or environment' }, { status: 400 });
    }

    if (status === 'PENDING') {
        // Normal ingestion: Phase 1 (data loading) then Phase 2 (vectorization)
        waitUntil(
            runPhase1(job_id).then(() => runPhase2(job_id, environment))
        );
    } else if (status === 'QUEUED_FOR_VEC') {
        // Retroactive vectorization: job was created directly in QUEUED_FOR_VEC, skip Phase 1
        waitUntil(runPhase2(job_id, environment));
    }

    // Respond immediately — processing continues in the background via waitUntil
    return NextResponse.json({ received: true });
}
