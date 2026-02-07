/**
 * Vectorization Worker
 *
 * This worker is triggered by Vercel Cron to process VECTORIZE jobs from the queue.
 * It handles Phase 2 of ingestion: generating AI embeddings for records.
 *
 * Cron Schedule: Every minute (defined in vercel.json)
 * Max Duration: 60 seconds (Vercel Pro plan)
 * Concurrency: Single instance per project (enforced by queue logic)
 *
 * Processing Flow:
 * 1. Claim next VECTORIZE job from queue
 * 2. Fetch records without embeddings
 * 3. Generate embeddings in batches of 25
 * 4. Update records with embedding vectors
 * 5. Update IngestJob status
 * 6. Mark job as completed
 */

import { NextResponse } from 'next/server';
import { DatabaseQueue } from '@/lib/queue/db-queue';
import { prisma } from '@/lib/prisma';
import { getEmbeddings } from '@/lib/ai';

// Vercel function configuration
export const maxDuration = 60; // 60 seconds (Pro plan)
export const dynamic = 'force-dynamic';

/**
 * Generate embeddings for a batch of records
 */
async function vectorizeBatch(records: any[], projectId: string, jobId?: string) {
  const BATCH_SIZE = 25; // AI service batch size
  let vectorizedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    try {
      // Prepare texts for embedding
      const texts = batch.map((r: any) => r.content || '');

      // Generate embeddings
      const embeddings = await getEmbeddings(texts);

      // Update records with embeddings using raw SQL for vector type
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const embedding = embeddings[j];

        if (embedding && embedding.length > 0) {
          // Convert to PostgreSQL vector format (matches existing pattern in src/lib/ingestion.ts)
          const vectorString = `[${embedding.join(',')}]`;
          await prisma.$executeRaw`
            UPDATE public.data_records
            SET embedding = ${vectorString}::vector
            WHERE id = ${record.id}
          `;

          vectorizedCount++;
        }
      }

      // Update progress
      if (jobId) {
        await DatabaseQueue.updateProgress(
          jobId,
          vectorizedCount,
          records.length,
          `Vectorized ${vectorizedCount} records`
        );
      }
    } catch (error) {
      console.error('[Vectorization Worker] Failed to vectorize batch:', error);
      // Continue with next batch even if this one fails
    }
  }

  return vectorizedCount;
}

/**
 * GET handler for Vercel Cron
 */
export async function GET(request: Request) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Security: Require CRON_SECRET in production
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Vectorization Worker] CRON_SECRET not set in production - worker endpoints are unauthenticated!');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    console.warn('[Vectorization Worker] CRON_SECRET not set - worker endpoint is unauthenticated');
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Vectorization Worker] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Vectorization Worker] Starting job processing...');

  let processedCount = 0;
  const maxJobsPerRun = 2; // Process fewer jobs due to AI latency (Pro plan: 60s limit)
  const startTime = Date.now();

  try {
    // Process jobs until max reached or timeout approaching (50s buffer for 60s limit)
    while (processedCount < maxJobsPerRun && (Date.now() - startTime) < 50000) {
      // Claim next job
      const job = await DatabaseQueue.claimJob(['VECTORIZE']);

      if (!job) {
        console.log('[Vectorization Worker] No more jobs available');
        break;
      }

      console.log(`[Vectorization Worker] Processing job ${job.job_id}`);

      try {
        const { ingestJobId, projectId } = job.payload;

        // Update IngestJob status
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: { status: 'VECTORIZING' },
        });

        // Fetch records without embeddings using raw SQL
        // Reduced batch size to fit within 60s Pro plan limit
        const records: { id: string; content: string }[] = await prisma.$queryRaw`
          SELECT id, content
          FROM public.data_records
          WHERE "projectId" = ${projectId}
          AND embedding IS NULL
          LIMIT 250
        `;

        console.log(`[Vectorization Worker] Found ${records.length} records to vectorize`);

        if (records.length === 0) {
          // No records to vectorize, mark as completed
          await prisma.ingestJob.update({
            where: { id: ingestJobId },
            data: { status: 'COMPLETED' },
          });

          await DatabaseQueue.completeJob(job.job_id, { vectorizedCount: 0 });
          processedCount++;
          continue;
        }

        // Vectorize in batches
        const vectorizedCount = await vectorizeBatch(records, projectId, job.job_id);

        // Check if there are more records to vectorize using raw SQL
        const remainingResult: { count: number }[] = await prisma.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM public.data_records
          WHERE "projectId" = ${projectId}
          AND embedding IS NULL
        `;
        const remainingCount = remainingResult[0]?.count || 0;

        if (remainingCount > 0) {
          // Re-enqueue for more vectorization
          await DatabaseQueue.enqueue({
            jobType: 'VECTORIZE',
            payload: {
              ingestJobId,
              projectId,
            },
            priority: 0,
          });

          console.log(`[Vectorization Worker] Re-enqueued job, ${remainingCount} records remaining`);
        } else {
          // All done, mark as completed
          await prisma.ingestJob.update({
            where: { id: ingestJobId },
            data: { status: 'COMPLETED' },
          });
        }

        // Mark queue job as completed
        await DatabaseQueue.completeJob(job.job_id, { vectorizedCount });

        processedCount++;
        console.log(`[Vectorization Worker] Completed job ${job.job_id}, vectorized ${vectorizedCount} records`);
      } catch (error) {
        console.error(`[Vectorization Worker] Failed to process job ${job.job_id}:`, error);

        // Mark queue job as failed
        await DatabaseQueue.failJob(job.job_id, error);

        // Update IngestJob status
        const { ingestJobId } = job.payload;
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    console.log(`[Vectorization Worker] Processed ${processedCount} jobs in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Vectorization Worker] Worker error:', error);
    return NextResponse.json(
      {
        error: 'Worker error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
