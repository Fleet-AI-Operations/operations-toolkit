import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';

export const maxDuration = 60;

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

const BATCH_SIZE = 10;
const CONTENT_TRUNCATE = 500;

const SYSTEM_PROMPT = `You are a quality assessor for an AI training dataset. Your job is to evaluate task quality objectively and return structured JSON only. Do not add any commentary outside the JSON.`;

function buildPrompt(records: Array<{ id: string; content: string }>): string {
    const taskList = records.map((r, i) => {
        const truncated = r.content.length > CONTENT_TRUNCATE
            ? r.content.slice(0, CONTENT_TRUNCATE) + '...'
            : r.content;
        return `[${i + 1}] ID: ${r.id}\n${truncated}`;
    }).join('\n\n');

    return `Rate each of the following AI training tasks on a scale of 0–100 based on:
- Clarity: Is the task well-written and unambiguous?
- Specificity: Does it have appropriate, useful detail?
- Complexity: Is it genuinely non-trivial and challenging?
- Usefulness: Would this be a high-quality training example?

Score guide: 0–20 = very poor, 21–40 = below average, 41–60 = average, 61–80 = good, 81–100 = excellent.

Return ONLY a valid JSON array with no other text:
[
  { "id": "RECORD_ID", "score": 85, "reasoning": "one sentence" },
  ...
]

Tasks to evaluate:
${taskList}`;
}

function parseRatings(content: string): Array<{ id: string; score: number; reasoning: string }> {
    // Try direct parse first
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        // Fall through to regex extraction
    }

    // Extract JSON array from surrounding text
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            // Fall through
        }
    }

    return [];
}

/**
 * POST /api/ai-quality-rating/process
 * Process one batch of records for an AI quality rating job.
 * Recursively fires itself until all records are rated.
 */
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
        const job = await prisma.aIQualityJob.findUnique({ where: { id: jobId } });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // Stop if job is in a terminal state
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
            return NextResponse.json({ completed: true, status: job.status });
        }

        // Mark as PROCESSING on first batch
        if (job.status === 'PENDING') {
            await prisma.aIQualityJob.update({
                where: { id: jobId },
                data: { status: 'PROCESSING', updatedAt: new Date() },
            });
        }

        // Get already-rated record IDs to avoid re-processing
        const existingRatings = await prisma.aIQualityRating.findMany({
            where: { jobId },
            select: { recordId: true },
        });
        const ratedIds = existingRatings.map(r => r.recordId);

        // Fetch next unrated TASK records
        const records = await prisma.dataRecord.findMany({
            where: {
                environment: job.environment,
                type: 'TASK',
                ...(ratedIds.length > 0 ? { id: { notIn: ratedIds } } : {}),
            },
            select: { id: true, content: true },
            take: BATCH_SIZE,
        });

        // No more records — job is complete
        if (records.length === 0) {
            await prisma.aIQualityJob.update({
                where: { id: jobId },
                data: { status: 'COMPLETED', updatedAt: new Date() },
            });
            return NextResponse.json({ completed: true });
        }

        // Call LLM
        let parsedRatings: Array<{ id: string; score: number; reasoning: string }> = [];
        let errorCount = 0;

        try {
            const prompt = buildPrompt(records.map(r => ({
                id: r.id,
                content: r.content || '',
            })));

            const result = await generateCompletionWithUsage(prompt, SYSTEM_PROMPT, { silent: true });
            parsedRatings = parseRatings(result.content);
        } catch (aiError) {
            const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Unknown LLM error';
            console.error('[AIQualityRating] LLM error:', aiErrorMessage);
            errorCount = records.length;

            await prisma.aIQualityJob.update({
                where: { id: jobId },
                data: {
                    errorCount: { increment: errorCount },
                    errorMessage: aiErrorMessage,
                    updatedAt: new Date(),
                },
            });

            // Recurse to next batch even on AI error
            const baseUrl = process.env.NEXT_PUBLIC_FLEET_APP_URL || 'http://localhost:3004';
            fetch(`${baseUrl}/api/ai-quality-rating/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '' },
                body: JSON.stringify({ jobId }),
            }).then(res => {
                if (!res.ok) console.error(`[AIQualityRating] Recursive fetch returned ${res.status} for jobId=${jobId}`);
            }).catch(e => console.error('[AIQualityRating] Recursive fetch network error:', e));

            return NextResponse.json({ completed: false, error: 'LLM request failed' });
        }

        // Build set of valid IDs from the batch to guard against hallucinations
        const batchIds = new Set(records.map(r => r.id));
        const validRatings = parsedRatings.filter(r =>
            r.id && batchIds.has(r.id) &&
            typeof r.score === 'number' &&
            r.score >= 0 && r.score <= 100
        );

        errorCount = records.length - validRatings.length;

        // Bulk insert ratings
        if (validRatings.length > 0) {
            const contentMap = new Map(records.map(r => [r.id, r.content || '']));
            await prisma.aIQualityRating.createMany({
                data: validRatings.map(r => ({
                    id: crypto.randomUUID(),
                    jobId,
                    recordId: r.id,
                    content: contentMap.get(r.id) || '',
                    score: Math.round(r.score),
                    reasoning: r.reasoning || null,
                })),
                skipDuplicates: true,
            });
        }

        // Update job progress
        await prisma.aIQualityJob.update({
            where: { id: jobId },
            data: {
                processedCount: { increment: validRatings.length },
                errorCount: { increment: errorCount },
                updatedAt: new Date(),
            },
        });

        // Recurse to process next batch
        const baseUrl = process.env.NEXT_PUBLIC_FLEET_APP_URL || 'http://localhost:3004';
        fetch(`${baseUrl}/api/ai-quality-rating/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '' },
            body: JSON.stringify({ jobId }),
        }).catch(e => console.error('[AIQualityRating] Recursive fetch failed:', e));

        return NextResponse.json({ completed: false, processed: validRatings.length });
    } catch (error) {
        console.error('[AIQualityRating] Batch processing error:', error);

        // Mark job as failed on unexpected errors
        try {
            await prisma.aIQualityJob.update({
                where: { id: jobId },
                data: {
                    status: 'FAILED',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    updatedAt: new Date(),
                },
            });
        } catch (updateError) {
            console.error('[AIQualityRating] Failed to update job status:', updateError);
        }

        return NextResponse.json({ error: 'Batch processing failed' }, { status: 500 });
    }
}
