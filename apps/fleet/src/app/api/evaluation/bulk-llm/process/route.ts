import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processEvaluationBatch } from '@repo/core/evaluation';

export const maxDuration = 60; // Extend Vercel timeout if possible

function verifyWebhookSecret(req: NextRequest): boolean {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return false;
    const provided = req.headers.get('x-webhook-secret') ?? '';
    try {
        return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
    } catch {
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
        // Process one batch (e.g., 5 items)
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
            }).catch(e => console.error('Recursive fetch failed', e));
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Batch processing error:', error);
        return NextResponse.json({ error: 'Batch processing failed' }, { status: 500 });
    }
}
