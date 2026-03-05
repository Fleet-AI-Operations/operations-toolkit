import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { runPhase1, runPhase2 } from '@repo/core/ingestion';

export const dynamic = 'force-dynamic';

// Allow up to 5 minutes per phase. Each invocation handles exactly one phase
// (Phase 1 or Phase 2) in its own 300s Vercel window.
// Vercel Pro supports up to 300s; increase to 900s on Enterprise if needed.
export const maxDuration = 300;

/**
 * POST /api/ingest/process-job
 *
 * Webhook receiver called by two Supabase DB triggers (via pg_net):
 *   1. on_ingest_job_created        — fires on INSERT (status = PENDING), starts Phase 1
 *   2. on_ingest_job_queued_for_vec — fires on UPDATE to QUEUED_FOR_VEC, starts Phase 2
 *
 * Each trigger produces a separate invocation so Phase 1 and Phase 2 each get
 * their own 300s Vercel function window. This endpoint responds immediately and
 * uses waitUntil to run processing after the response is sent.
 *
 * Payload (set by the DB trigger):
 *   { job_id: string, environment: string, status: string }
 *
 * Security: requests must include the x-webhook-secret header matching WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
        // Misconfigured deployment — fail loudly so it surfaces in logs immediately.
        console.error('[process-job] WEBHOOK_SECRET is not set. Configure it in Vercel environment variables.');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const secret = req.headers.get('x-webhook-secret');
    if (!secret || secret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { job_id?: string; environment?: string; status?: string };
    try {
        body = await req.json();
    } catch {
        console.error('[process-job] Failed to parse webhook body — malformed JSON from pg_net');
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { job_id, environment, status } = body;

    if (!job_id || !environment || !status) {
        return NextResponse.json({ error: 'Missing job_id, environment, or status' }, { status: 400 });
    }

    if (status === 'PENDING') {
        // Phase 1 (data loading) only. When it completes it sets status to QUEUED_FOR_VEC,
        // which fires the on_ingest_job_queued_for_vec DB trigger → a fresh webhook call →
        // Phase 2 in a new function invocation with its own 300s window.
        waitUntil(
            runPhase1(job_id)
                .catch(err => console.error(`[process-job] Job ${job_id} Phase 1 failed:`, err))
        );
    } else if (status === 'QUEUED_FOR_VEC') {
        // Phase 2 (vectorization). Triggered by the on_ingest_job_queued_for_vec DB trigger
        // after Phase 1 sets status to QUEUED_FOR_VEC. Also handles retroactive vectorization
        // jobs seeded directly in QUEUED_FOR_VEC status.
        waitUntil(
            runPhase2(job_id, environment)
                .catch(err => console.error(`[process-job] Job ${job_id} Phase 2 failed:`, err))
        );
    } else {
        console.warn(`[process-job] Unexpected status '${status}' for job ${job_id} — no action taken`);
    }

    // Respond immediately — processing continues in the background via waitUntil
    return NextResponse.json({ received: true });
}
