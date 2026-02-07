/**
 * Ingestion Worker
 *
 * This worker is triggered by Vercel Cron to process INGEST_DATA jobs from the queue.
 * It handles Phase 1 of ingestion: loading data into the database.
 *
 * Cron Schedule: Every minute (defined in vercel.json)
 * Max Duration: 60 seconds (Vercel Pro plan)
 * Concurrency: Multiple instances can run in parallel
 *
 * Processing Flow:
 * 1. Claim next INGEST_DATA job from queue
 * 2. Load data into database in batches
 * 3. Update IngestJob status
 * 4. If vectorization needed, enqueue VECTORIZE job
 * 5. Mark job as completed
 */

import { NextResponse } from 'next/server';
import { DatabaseQueue } from '@/lib/queue/db-queue';
import { prisma } from '@/lib/prisma';
import { processAndStore } from '@/lib/ingestion';

// Vercel function configuration
export const maxDuration = 60; // 60 seconds (Pro plan)
export const dynamic = 'force-dynamic';

// Removed processDataBatch - using processAndStore from @/lib/ingestion for feature parity

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
      console.error('[Ingestion Worker] CRON_SECRET not set in production - worker endpoints are unauthenticated!');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    console.warn('[Ingestion Worker] CRON_SECRET not set - worker endpoint is unauthenticated');
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Ingestion Worker] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Ingestion Worker] Starting job processing...');

  let processedCount = 0;
  const maxJobsPerRun = 3; // Process up to 3 jobs per cron invocation (Pro plan: 60s limit)
  const startTime = Date.now();

  try {
    // Process jobs until max reached or timeout approaching (50s buffer for 60s limit)
    while (processedCount < maxJobsPerRun && (Date.now() - startTime) < 50000) {
      // Claim next job
      const job = await DatabaseQueue.claimJob(['INGEST_DATA']);

      if (!job) {
        console.log('[Ingestion Worker] No more jobs available');
        break;
      }

      console.log(`[Ingestion Worker] Processing job ${job.job_id}`);

      try {
        const { ingestJobId, projectId, records, generateEmbeddings, source, filterKeywords, type } = job.payload;

        // Update IngestJob status
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: {
            status: 'PROCESSING',
            totalRecords: records.length,
          },
        });

        // Use processAndStore for full feature parity (duplicate detection, category detection, keyword filtering)
        const options = {
          projectId,
          source: source || 'queue',
          type: type || 'TASK',
          filterKeywords,
          generateEmbeddings,
        };

        const result = await processAndStore(records, options, ingestJobId);

        // Update IngestJob to completed
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: {
            status: generateEmbeddings ? 'QUEUED_FOR_VEC' : 'COMPLETED',
            savedCount: result.savedCount,
            skippedCount: result.skippedCount,
          },
        });

        // If vectorization needed, enqueue next phase
        if (generateEmbeddings && result.savedCount > 0) {
          await DatabaseQueue.enqueue({
            jobType: 'VECTORIZE',
            payload: {
              ingestJobId,
              projectId,
            },
            priority: 0, // Lower priority than data loading
          });
        }

        // Mark queue job as completed
        await DatabaseQueue.completeJob(job.job_id, {
          savedCount: result.savedCount,
          skippedCount: result.skippedCount,
        });

        processedCount++;
        console.log(`[Ingestion Worker] Completed job ${job.job_id}`);
      } catch (error) {
        console.error(`[Ingestion Worker] Failed to process job ${job.job_id}:`, error);

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

    console.log(`[Ingestion Worker] Processed ${processedCount} jobs in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Ingestion Worker] Worker error:', error);
    return NextResponse.json(
      {
        error: 'Worker error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
