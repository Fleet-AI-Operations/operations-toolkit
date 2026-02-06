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
import { parseCSV } from '@/lib/ingestion';

// Vercel function configuration
export const maxDuration = 60; // 60 seconds (Pro plan)
export const dynamic = 'force-dynamic';

/**
 * Process a batch of records into the database
 */
async function processDataBatch(records: any[], projectId: string, ingestJobId: string, source: string, jobId?: string) {
  const BATCH_SIZE = 100;
  let savedCount = 0;
  let skippedCount = 0;
  const skippedDetails: any[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      try {
        // Create data record
        await prisma.dataRecord.create({
          data: {
            projectId,
            type: record.type || 'TASK',
            source,
            content: record.content,
            metadata: record.metadata || {},
            createdByEmail: record.createdByEmail || null,
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          },
        });

        savedCount++;
      } catch (error) {
        skippedCount++;
        skippedDetails.push({
          record: record.content?.substring(0, 50),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update progress
    await prisma.ingestJob.update({
      where: { id: ingestJobId },
      data: {
        savedCount,
        skippedCount,
        ...(skippedDetails.length > 0 && { skippedDetails }),
      },
    });

    // Update job queue progress
    if (jobId) {
      await DatabaseQueue.updateProgress(
        jobId,
        savedCount + skippedCount,
        records.length,
        `Saved ${savedCount} records`
      );
    }
  }

  return { savedCount, skippedCount, skippedDetails };
}

/**
 * GET handler for Vercel Cron
 */
export async function GET(request: Request) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

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
        const { ingestJobId, projectId, records, generateEmbeddings, source } = job.payload;

        // Update IngestJob status
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: {
            status: 'PROCESSING',
            totalRecords: records.length,
          },
        });

        // Process data batch
        const result = await processDataBatch(records, projectId, ingestJobId, source || 'queue', job.job_id);

        // Update IngestJob to completed
        await prisma.ingestJob.update({
          where: { id: ingestJobId },
          data: {
            status: generateEmbeddings ? 'QUEUED_FOR_VEC' : 'COMPLETED',
            savedCount: result.savedCount,
            skippedCount: result.skippedCount,
            ...(result.skippedDetails.length > 0 && { skippedDetails: result.skippedDetails }),
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
