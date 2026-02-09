import { NextRequest, NextResponse } from 'next/server';
import { processEvaluationBatch } from '@repo/core/evaluation';

export const maxDuration = 60; // Extend Vercel timeout if possible

export async function POST(request: NextRequest) {
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

            // "Fire and forget" the next batch
            fetch(`${baseUrl}/api/evaluation/bulk-llm/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId })
            }).catch(e => console.error('Recursive fetch failed', e));
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error('Batch processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
