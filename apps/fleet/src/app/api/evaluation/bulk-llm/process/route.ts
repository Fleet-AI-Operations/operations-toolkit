import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processEvaluationBatch } from '@repo/core/evaluation';
import { prisma } from '@repo/database';

export const maxDuration = 60; // Extend Vercel timeout if possible

function verifyWebhookSecret(req: NextRequest): boolean {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
        console.error('[verifyWebhookSecret] WEBHOOK_SECRET is not set — all webhook calls will be rejected');
        return false;
    }
    const provided = req.headers.get('x-webhook-secret') ?? '';
    const providedBuf = Buffer.from(provided);
    const secretBuf = Buffer.from(secret);
    // Pre-check lengths to avoid RangeError from timingSafeEqual on mismatched buffers
    if (providedBuf.length !== secretBuf.length) return false;
    try {
        return timingSafeEqual(providedBuf, secretBuf);
    } catch (err) {
        console.error('[verifyWebhookSecret] Unexpected crypto error:', err);
        return false;
    }
}

export async function POST(request: NextRequest) {
    if (!verifyWebhookSecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    try {
        // Process one batch — batch size configured in @repo/core/evaluation
        const result = await processEvaluationBatch(jobId);

        // If job is not complete, recursively call this endpoint again
        if (!result.completed) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const secret = process.env.WEBHOOK_SECRET ?? '';

            // "Fire and forget" the next batch
            fetch(`${baseUrl}/api/evaluation/bulk-llm/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
                body: JSON.stringify({ jobId })
            }).then(res => {
                if (!res.ok) console.error(`[BulkLLM] Recursive fetch returned ${res.status} for jobId=${jobId}`);
            }).catch(e => console.error('[BulkLLM] Recursive fetch network error:', e));
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error(`[BulkLLM] Batch processing error for jobId=${jobId}:`, error);
        try {
            await prisma.lLMEvaluationJob.update({
                where: { id: jobId },
                data: { status: 'FAILED', updatedAt: new Date() },
            });
        } catch (updateError) {
            console.error('[BulkLLM] Failed to mark job as FAILED:', updateError);
        }
        return NextResponse.json({ error: 'Batch processing failed' }, { status: 500 });
    }
}
