/**
 * Database-backed Job Queue Service
 *
 * This module provides a persistent job queue using PostgreSQL as the backing store.
 * It replaces the previous in-memory queue system with a more reliable and scalable solution.
 *
 * Key Features:
 * - Persistent: Jobs survive server restarts and redeployments
 * - Concurrent: Multiple workers can process jobs in parallel using row-level locking
 * - Reliable: Automatic retries, dead letter queue for failed jobs
 * - Simple: Just SQL queries, no external dependencies
 *
 * Architecture:
 * 1. API routes enqueue jobs → job_queue table
 * 2. Vercel cron workers poll for jobs → claim_next_job()
 * 3. Workers process jobs → update status
 * 4. Failed jobs retry up to max_attempts
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type JobType = 'INGEST_DATA' | 'VECTORIZE';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface QueueJob {
  jobType: JobType;
  payload: any;
  priority?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
}

export interface ClaimedJob {
  job_id: string;
  job_type: JobType;
  payload: any;
}

/**
 * DatabaseQueue class provides methods to interact with the job queue
 */
export class DatabaseQueue {
  /**
   * Enqueue a new job for processing
   *
   * @param job - Job configuration including type, payload, and options
   * @returns The created job record
   *
   * @example
   * await DatabaseQueue.enqueue({
   *   jobType: 'INGEST_DATA',
   *   payload: { ingestJobId, projectId, records },
   *   priority: 1
   * });
   */
  static async enqueue(job: QueueJob) {
    try {
      const data = await prisma.jobQueue.create({
        data: {
          jobType: job.jobType,
          payload: job.payload,
          priority: job.priority ?? 0,
          scheduledFor: job.scheduledFor ?? new Date(),
          maxAttempts: job.maxAttempts ?? 3,
        },
      });

      console.log(`[DatabaseQueue] Enqueued job ${data.id} of type ${job.jobType}`);
      return data;
    } catch (error) {
      console.error('[DatabaseQueue] Failed to enqueue job:', error);
      throw new Error(`Failed to enqueue job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Claim the next available job for processing
   *
   * This method uses PostgreSQL's FOR UPDATE SKIP LOCKED to atomically claim jobs
   * without race conditions. Multiple workers can call this concurrently.
   *
   * @param workerTypes - Array of job types this worker can process
   * @returns The claimed job, or null if no jobs available
   *
   * @example
   * const job = await DatabaseQueue.claimJob(['INGEST_DATA']);
   * if (job) {
   *   // Process the job
   *   await processJob(job.payload);
   *   await DatabaseQueue.completeJob(job.job_id);
   * }
   */
  static async claimJob(workerTypes: JobType[]): Promise<ClaimedJob | null> {
    try {
      // Use parameterized query to safely pass array to PostgreSQL function
      // Prisma will properly escape and format the array
      const result = await prisma.$queryRaw<ClaimedJob[]>`
        SELECT * FROM claim_next_job(${workerTypes}::text[])
      `;

      if (!result || result.length === 0) {
        return null;
      }

      const job = result[0];
      console.log(`[DatabaseQueue] Claimed job ${job.job_id} of type ${job.job_type}`);
      return job;
    } catch (error) {
      console.error('[DatabaseQueue] Failed to claim job:', error);
      throw new Error(`Failed to claim job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Mark a job as successfully completed
   *
   * @param jobId - The job ID to mark as completed
   * @param result - Optional result data to store
   */
  static async completeJob(jobId: string, result?: any) {
    try {
      await prisma.jobQueue.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          result: result ?? null,
          payload: Prisma.JsonNull, // Clear payload to free up space (can be large for CSV ingestion)
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`[DatabaseQueue] Completed job ${jobId}`);
    } catch (error) {
      console.error('[DatabaseQueue] Failed to complete job:', error);
      throw new Error(`Failed to complete job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Mark a job as failed
   *
   * If the job has not exceeded max_attempts, it will automatically be retried
   * by the next worker poll.
   *
   * @param jobId - The job ID to mark as failed
   * @param error - Error information to store
   */
  static async failJob(jobId: string, error: any) {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Get current job state to check retry attempts
      const job = await prisma.jobQueue.findUnique({
        where: { id: jobId },
        select: { attempts: true, maxAttempts: true },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const hasRetriesRemaining = job.attempts < job.maxAttempts;

      if (hasRetriesRemaining) {
        // Still have retries - set back to PENDING with exponential backoff
        const backoffSeconds = Math.min(300, Math.pow(2, job.attempts) * 10); // Max 5 min
        const scheduledFor = new Date(Date.now() + backoffSeconds * 1000);

        await prisma.jobQueue.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            scheduledFor,
            result: {
              lastError: errorMessage,
              lastErrorStack: errorStack,
              timestamp: new Date().toISOString(),
            },
            updatedAt: new Date(),
          },
        });

        console.warn(`[DatabaseQueue] Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), will retry in ${backoffSeconds}s`);
      } else {
        // No retries remaining - mark as permanently FAILED
        await prisma.jobQueue.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            result: {
              error: errorMessage,
              stack: errorStack,
              timestamp: new Date().toISOString(),
            },
            payload: Prisma.JsonNull, // Clear payload to free up space
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.error(`[DatabaseQueue] Job ${jobId} permanently failed after ${job.attempts} attempts:`, errorMessage);
      }
    } catch (updateError) {
      console.error('[DatabaseQueue] Failed to mark job as failed:', updateError);
      throw new Error(`Failed to mark job as failed: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
    }
  }

  /**
   * Get the current status of a job
   *
   * @param jobId - The job ID to query
   * @returns The job record, or null if not found
   */
  static async getJobStatus(jobId: string) {
    try {
      const job = await prisma.jobQueue.findUnique({
        where: { id: jobId },
      });

      return job;
    } catch (error) {
      console.error('[DatabaseQueue] Failed to get job status:', error);
      return null;
    }
  }

  /**
   * Get queue statistics for monitoring
   *
   * @returns Object containing counts by status
   */
  static async getQueueStats() {
    try {
      // Use GROUP BY to efficiently count by status (avoids fetching all rows)
      const results = await prisma.jobQueue.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      });

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      results.forEach((result) => {
        const status = result.status.toLowerCase();
        if (status in stats) {
          stats[status as keyof typeof stats] = result._count.status;
        }
      });

      return stats;
    } catch (error) {
      console.error('[DatabaseQueue] Failed to get queue stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Clean up old completed jobs
   *
   * This should be run periodically (e.g., daily cron) to prevent the job_queue
   * table from growing indefinitely.
   *
   * @param olderThanDays - Delete jobs older than this many days (default: 7)
   * @returns Number of jobs deleted
   */
  static async cleanup(olderThanDays: number = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.jobQueue.deleteMany({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: cutoffDate },
        },
      });

      const deletedCount = result.count;
      console.log(`[DatabaseQueue] Cleaned up ${deletedCount} old jobs`);
      return deletedCount;
    } catch (error) {
      console.error('[DatabaseQueue] Failed to cleanup jobs:', error);
      throw new Error(`Failed to cleanup jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retry a failed job
   *
   * Resets a failed job back to PENDING status so it can be processed again.
   *
   * @param jobId - The job ID to retry
   */
  static async retryJob(jobId: string) {
    try {
      await prisma.jobQueue.update({
        where: { id: jobId },
        data: {
          status: 'PENDING',
          startedAt: null,
          completedAt: null,
          attempts: 0,
          updatedAt: new Date(),
        },
      });

      console.log(`[DatabaseQueue] Retrying job ${jobId}`);
    } catch (error) {
      console.error('[DatabaseQueue] Failed to retry job:', error);
      throw new Error(`Failed to retry job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update job progress
   *
   * @param jobId - The job ID to update
   * @param current - Current progress count
   * @param total - Total items to process
   * @param message - Optional progress message
   */
  static async updateProgress(jobId: string, current: number, total: number, message?: string) {
    try {
      await prisma.jobQueue.update({
        where: { id: jobId },
        data: {
          progress: {
            current,
            total,
            ...(message && { message }),
          },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[DatabaseQueue] Failed to update progress:', error);
      // Don't throw - progress updates are non-critical
    }
  }
}
