import { Prisma } from '@repo/database';
import { RecordType } from '@repo/types';
export interface IngestOptions {
    environment?: string;
    source: string;
    type?: RecordType;
    filterKeywords?: string[];
    generateEmbeddings?: boolean;
}
/**
 * ENTRY POINT: startBackgroundIngest
 *
 * NOTE: Stores payload and options in database instead of memory for serverless compatibility.
 * Vercel functions are stateless and terminate after sending HTTP response,
 * so in-memory caches don't persist across invocations.
 *
 * Environment and type can be extracted from CSV data if not provided.
 */
export declare function startBackgroundIngest(type: 'CSV' | 'API', payload: string, options: IngestOptions): Promise<string>;
/**
 * PUBLIC ENTRY POINT: processQueuedJobs
 * Triggers processing of both Phase 1 (Data Loading) and Phase 2 (Vectorization) jobs.
 * Safe to call repeatedly - internal locking prevents concurrent processing.
 *
 * SERVERLESS COMPATIBILITY: This function is called by the status endpoint on each poll
 * to ensure jobs actually get processed (since background triggers get killed when the
 * serverless function terminates after returning the HTTP response).
 *
 * If environment is provided, only processes jobs for that environment.
 * If not provided, processes jobs for all environments.
 */
export declare function processQueuedJobs(environment?: string): Promise<void>;
/**
 * Phase 1: Data Loading
 * Parses records, filters by content/keywords, detects categories, and prevents duplicates.
 *
 * New Feature: Detailed Skip Tracking
 * - Tracks 'Keyword Mismatch' (filtered out by user keywords)
 * - Tracks 'Duplicate ID' (existing Task ID or Feedback ID in environment)
 * - Updates `IngestJob.skippedDetails` JSON for UI visibility.
 */
export declare function processAndStore(records: any[], options: IngestOptions, jobId: string): Promise<{
    savedCount: number;
    skippedCount: number;
    cancelled: boolean;
} | {
    savedCount: number;
    skippedCount: number;
    cancelled?: undefined;
}>;
export declare function cancelIngest(jobId: string): Promise<void>;
export declare function getIngestStatus(jobId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    environment: string;
    error: string | null;
    status: string;
    totalRecords: number;
    type: import("@prisma/client").$Enums.RecordType;
    savedCount: number;
    skippedCount: number;
    skippedDetails: Prisma.JsonValue | null;
    payload: string | null;
    options: Prisma.JsonValue | null;
} | null>;
export declare function deleteIngestedData(jobId: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map