/**
 * Ingestion Hub - Flexible data ingestion system for CSV/API sources
 *
 * Key Features:
 * - Multi-column content detection (feedback, prompt, text, etc.)
 * - Flexible rating detection (top_10, Top 10%, numerical scores, etc.)
 * - Type-aware duplicate prevention (TASK vs FEEDBACK)
 * - Parallel processing with chunking for large datasets
 * - Serverless-compatible: Payload stored in database, cleared after completion
 *
 * SERVERLESS ARCHITECTURE:
 * - Jobs are created with PENDING status
 * - Processing is triggered on job creation AND on each status check
 * - This "double trigger" pattern ensures jobs actually get processed:
 *   1. Initial trigger may be killed when serverless function terminates
 *   2. Status endpoint re-triggers processing on each poll
 * - Internal locking prevents concurrent processing of the same job
 * - This approach works without external queue services or cron jobs
 *
 * SECURITY NOTE:
 * - CSV payloads may contain PII and are stored temporarily in the database
 * - Payloads are automatically cleared after job completion (success or failure)
 * - RLS policies on ingest_jobs table should restrict access to authorized users
 * - For sensitive data, consider encrypting payloads at rest or using separate storage
 */
import { parse } from 'csv-parse/sync';
import { prisma } from './prisma';
import { getEmbeddings } from './ai';
import { RecordType, RecordCategory, Prisma } from '@prisma/client';

export interface IngestOptions {
    projectId: string;
    source: string;
    type: RecordType;
    filterKeywords?: string[];
    generateEmbeddings?: boolean;
}

/**
 * Parse CSV content into records
 * Used by the new queue-based ingestion system
 */
export function parseCSV(csvContent: string, options?: { type?: RecordType; filterKeywords?: string[] }) {
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
    });

    // Transform records to include type and metadata, filtering out empty content
    return records
        .map((record: any) => ({
            content: record.content || record.feedback_content || record.feedback || record.prompt || record.text || '',
            type: options?.type || 'TASK',
            metadata: record,
            createdByEmail: record.createdByEmail || record.created_by_email || record.email || null,
            createdAt: record.createdAt || record.created_at || null,
        }))
        .filter((record) => record.content && record.content.length >= 10); // Filter out empty or very short content
}

/**
 * ENTRY POINT: startBackgroundIngest
 *
 * NOTE: Stores payload and options in database instead of memory for serverless compatibility.
 * Vercel functions are stateless and terminate after sending HTTP response,
 * so in-memory caches don't persist across invocations.
 */
export async function startBackgroundIngest(type: 'CSV' | 'API', payload: string, options: IngestOptions) {
    const job = await prisma.ingestJob.create({
        data: {
            projectId: options.projectId,
            type: options.type,
            status: 'PENDING',
            payload: payload,  // Store in database for serverless compatibility
            options: {
                ...options,
                type: type,  // Store whether CSV or API
            } as any,
        }
    });

    // Trigger processing (will be killed in serverless, but status endpoint will re-trigger)
    processQueuedJobs(options.projectId).catch(err => console.error('Queue Processor Error:', err));
    return job.id;
}

/**
 * PUBLIC ENTRY POINT: processQueuedJobs
 * Triggers processing of both Phase 1 (Data Loading) and Phase 2 (Vectorization) jobs.
 * Safe to call repeatedly - internal locking prevents concurrent processing.
 *
 * SERVERLESS COMPATIBILITY: This function is called by the status endpoint on each poll
 * to ensure jobs actually get processed (since background triggers get killed when the
 * serverless function terminates after returning the HTTP response).
 */
export async function processQueuedJobs(projectId: string) {
    // Trigger both queues - they have internal locking to prevent concurrent execution
    await Promise.allSettled([
        processJobs(projectId),
        processVectorizationJobs(projectId)
    ]);
}

/**
 * QUEUE PROCESSOR: processJobs
 * Manages Phase 1 (Data Loading). This phase can run in parallel with Phase 2 (Vectorizing).
 * However, we still only allow one PROCESSING job per project to ensure DB write order.
 */
async function processJobs(projectId: string) {
    const activeProcessing = await prisma.ingestJob.findFirst({
        where: { projectId, status: 'PROCESSING' }
    });

    if (activeProcessing) {
        // In serverless, we can't rely on memory state, so just return and let the job be picked up later
        return; // Wait for the active data load to finish
    }

    const nextJob = await prisma.ingestJob.findFirst({
        where: { projectId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
    });

    if (!nextJob) return;

    if (!nextJob.payload) {
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: 'Job payload missing from database.' }
        });
        processJobs(projectId);
        return;
    }

    if (!nextJob.options) {
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: 'Job options missing from database.' }
        });
        processJobs(projectId);
        return;
    }

    // Reconstruct cache object from database-stored payload and options
    const storedOptions = nextJob.options as any;
    const cache = {
        type: (storedOptions.type || 'CSV') as 'CSV' | 'API',
        payload: nextJob.payload,
        options: {
            projectId: nextJob.projectId,
            source: storedOptions.source || 'csv',
            type: nextJob.type,
            filterKeywords: storedOptions.filterKeywords,
            generateEmbeddings: storedOptions.generateEmbeddings ?? true,
        }
    };

    try {
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'PROCESSING' }
        });

        let records: any[] = [];
        if (cache.type === 'CSV') {
            records = parse(cache.payload, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });
        } else {
            const response = await fetch(cache.payload);
            const data = await response.json();
            records = Array.isArray(data) ? data : [data];
        }

        await processAndStore(records, cache.options, nextJob.id);

        // Phase 1 Complete: Mark as queued for vectorization
        if (cache.options.generateEmbeddings) {
            await prisma.ingestJob.update({
                where: { id: nextJob.id },
                data: { status: 'QUEUED_FOR_VEC' }
            });
            // Trigger vectorization queue processor
            processVectorizationJobs(projectId).catch(err => console.error('Vectorization Queue Error:', err));
        } else {
            // No vectorization needed, mark as complete and clear payload
            await prisma.ingestJob.update({
                where: { id: nextJob.id },
                data: { status: 'COMPLETED', payload: null }
            });
        }

        processJobs(projectId);

    } catch (error: any) {
        console.error('[Ingestion] Job failed:', error);
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: error.message, payload: null }
        });
        processJobs(projectId);
    }
}

/**
 * VECTORIZATION QUEUE PROCESSOR: processVectorizationJobs
 * Manages Phase 2 (Vectorization). Only one VECTORIZING job per project is allowed
 * to prevent overloading the AI server.
 */
async function processVectorizationJobs(projectId: string) {
    // Check if there's already a job vectorizing for this project
    const activeVectorizing = await prisma.ingestJob.findFirst({
        where: { projectId, status: 'VECTORIZING' }
    });

    if (activeVectorizing) {
        return; // Wait for active vectorization to finish
    }

    // Get the next job queued for vectorization
    const nextJob = await prisma.ingestJob.findFirst({
        where: { projectId, status: 'QUEUED_FOR_VEC' },
        orderBy: { createdAt: 'asc' }
    });

    if (!nextJob) return;

    try {
        // Mark as vectorizing
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'VECTORIZING' }
        });

        // Run vectorization
        await vectorizeJob(nextJob.id, projectId);

        // Mark as complete and clear payload
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'COMPLETED', payload: null }
        });

        // Process next job in queue
        processVectorizationJobs(projectId);

    } catch (error: any) {
        console.error('[Vectorization] Job failed:', error);
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: error.message, payload: null }
        });
        processVectorizationJobs(projectId);
    }
}

/**
 * Phase 2: Vectorization
 * Iterates through records in the project that lack embeddings and generates them using the active AI provider.
 *
 * Note: Scoped to the Project ID. This serves as a self-healing mechanism: any record in the project
 * missing an embedding (from this job or previous failed jobs) will be processed.
 *
 * Uses raw SQL for vector operations because Prisma's Unsupported("vector") type
 * is excluded from the TypeScript client - this is the documented pattern for pgvector.
 *
 * Retry Strategy:
 * - Tracks failed record IDs to avoid infinite retries on the same batch
 * - After MAX_RETRIES_PER_RECORD attempts, marks records with embedding error in metadata
 * - Continues processing other batches instead of failing the entire job on intermittent API failures
 */
async function vectorizeJob(jobId: string, projectId: string) {
    const RECORDS_BATCH_SIZE = 50;
    const MAX_RETRIES_PER_RECORD = 3;
    const failedRecordAttempts = new Map<string, number>(); // Track retry attempts per record
    const permanentlyFailedIds = new Set<string>(); // Track IDs that have been marked as failed
    let totalEmbedded = 0;
    let totalSkipped = 0;

    while (true) {
        // Check for cancellation
        const job = await prisma.ingestJob.findUnique({ where: { id: jobId }, select: { status: true } });
        if (job?.status === 'CANCELLED') break;

        // Fetch records that need embeddings (NULL embedding) using raw SQL
        // Exclude permanently failed records to avoid infinite loops
        // Also exclude records that already have embeddingError in metadata
        const failedIdsArray = Array.from(permanentlyFailedIds);
        const batch: { id: string; content: string; metadata: unknown }[] = failedIdsArray.length > 0
            ? await prisma.$queryRaw`
                SELECT id, content, metadata FROM public.data_records
                WHERE "projectId" = ${projectId}
                AND embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                AND id NOT IN (${Prisma.join(failedIdsArray)})
                ORDER BY id ASC
                LIMIT ${RECORDS_BATCH_SIZE}
            `
            : await prisma.$queryRaw`
                SELECT id, content, metadata FROM public.data_records
                WHERE "projectId" = ${projectId}
                AND embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                ORDER BY id ASC
                LIMIT ${RECORDS_BATCH_SIZE}
            `;

        if (batch.length === 0) break;

        // Separate records by retry status
        const recordsToProcess: typeof batch = [];
        const recordsToSkip: typeof batch = [];

        for (const record of batch) {
            const attempts = failedRecordAttempts.get(record.id) || 0;
            if (attempts >= MAX_RETRIES_PER_RECORD) {
                recordsToSkip.push(record);
            } else {
                recordsToProcess.push(record);
            }
        }

        // Mark records that exceeded max retry attempts with error in metadata
        for (const record of recordsToSkip) {
            const updatedMetadata = {
                ...(typeof record.metadata === 'object' && record.metadata !== null ? record.metadata : {}),
                embeddingError: `Failed to generate embedding after ${MAX_RETRIES_PER_RECORD} attempts`
            };
            await prisma.dataRecord.update({
                where: { id: record.id },
                data: { metadata: updatedMetadata }
            });
            totalSkipped++;
            failedRecordAttempts.delete(record.id);
            permanentlyFailedIds.add(record.id); // Exclude from future queries
        }

        if (recordsToProcess.length === 0) continue;

        // Generate embeddings
        const contents = recordsToProcess.map(r => r.content);
        console.log(`[Vectorize] Generating embeddings for ${contents.length} records...`);

        const embeddings = await getEmbeddings(contents);

        // Count successful embeddings in this batch
        let batchSuccess = 0;

        // Save back to DB using raw SQL for vector type
        for (let i = 0; i < recordsToProcess.length; i++) {
            const vector = embeddings[i];
            const record = recordsToProcess[i];

            if (vector && vector.length > 0) {
                try {
                    // Use parameterized raw SQL - Prisma escapes all parameters
                    const vectorString = `[${vector.join(',')}]`;
                    await prisma.$executeRaw`
                        UPDATE public.data_records
                        SET embedding = ${vectorString}::vector
                        WHERE id = ${record.id}
                    `;
                    batchSuccess++;
                    totalEmbedded++;
                    // Clear from failed attempts on success
                    failedRecordAttempts.delete(record.id);
                } catch (error: any) {
                    // Check for dimension mismatch error
                    if (error.message?.includes('expected') && error.message?.includes('dimensions')) {
                        const dimensionMatch = error.message.match(/expected (\d+) dimensions, not (\d+)/);
                        if (dimensionMatch) {
                            throw new Error(
                                `Vector dimension mismatch: Database expects ${dimensionMatch[1]} dimensions, but embedding model returned ${dimensionMatch[2]} dimensions. ` +
                                `Update the migration: ALTER TABLE public.data_records ALTER COLUMN embedding TYPE vector(${dimensionMatch[2]});`
                            );
                        }
                    }
                    throw error;
                }
            } else {
                // Track failed attempt
                const attempts = failedRecordAttempts.get(record.id) || 0;
                failedRecordAttempts.set(record.id, attempts + 1);
            }
        }

        console.log(`[Vectorize] Batch result: ${batchSuccess}/${recordsToProcess.length} successful (total: ${totalEmbedded}, skipped: ${totalSkipped})`);

        // Wait briefly to avoid hammering API if experiencing issues
        if (batchSuccess === 0 && recordsToProcess.length > 0) {
            console.warn(`[Vectorize] Batch failed, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`[Vectorize] Job ${jobId} completed. Total embedded: ${totalEmbedded}, skipped due to persistent failures: ${totalSkipped}`);
}

/**
 * Phase 1: Data Loading
 * Parses records, filters by content/keywords, detects categories, and prevents duplicates.
 *
 * New Feature: Detailed Skip Tracking
 * - Tracks 'Keyword Mismatch' (filtered out by user keywords)
 * - Tracks 'Duplicate ID' (existing Task ID or Feedback ID in project)
 * - Updates `IngestJob.skippedDetails` JSON for UI visibility.
 */
export async function processAndStore(records: any[], options: IngestOptions, jobId: string) {
    const { projectId, source, type, filterKeywords } = options;
    const CHUNK_SIZE = 100;
    let savedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);

        // Check for cancellation
        const currentJob = await prisma.ingestJob.findUnique({
            where: { id: jobId },
            select: { status: true, skippedDetails: true }
        });
        if (currentJob?.status === 'CANCELLED') return { savedCount, skippedCount, cancelled: true };

        const currentDetails = (currentJob?.skippedDetails as Record<string, number>) || {};
        const chunkSkipDetails: Record<string, number> = {};

        const validChunk: { record: any, content: string, category: RecordCategory | null }[] = [];

        // 1. FILTER: Content, Ratings, Keywords
        for (let j = 0; j < chunk.length; j++) {
            const record = chunk[j];

            // --- Content Extraction ---
            let content = '';
            if (typeof record === 'string') {
                content = record;
            } else {
                content = record.feedback_content || record.feedback || record.prompt ||
                    record.content || record.body || record.task_content ||
                    record.text || record.message || record.instruction || record.response;

                if (!content || content.length < 10) {
                    const textFields = Object.entries(record)
                        .filter(([, val]) => typeof val === 'string' && String(val).length > 10)
                        .sort((a, b) => String(b[1]).length - String(a[1]).length);
                    if (textFields.length > 0) content = String(textFields[0][1]);
                }
                if (!content) content = JSON.stringify(record);
            }

            // --- Rating Detection ---
            let category: RecordCategory | null = null;
            const ratingValue = record.prompt_quality_rating || record.feedback_quality_rating || record.quality_rating ||
                record.rating || record.category || record.label || record.score || record.avg_score;
            const ratingRaw = (ratingValue || '').toString().toLowerCase().trim();

            if (ratingRaw.includes('top') && (ratingRaw.includes('10'))) category = RecordCategory.TOP_10;
            else if (ratingRaw.includes('bottom') && (ratingRaw.includes('10'))) category = RecordCategory.BOTTOM_10;
            else if (['top_10', 'top10', 'top', 'selected', 'better'].includes(ratingRaw)) category = RecordCategory.TOP_10;
            else if (['bottom_10', 'bottom10', 'bottom', 'rejected', 'worse'].includes(ratingRaw)) category = RecordCategory.BOTTOM_10;
            else if (!isNaN(parseFloat(ratingRaw)) && ratingRaw !== '') {
                const num = parseFloat(ratingRaw);
                if (num >= 4 || (num > 0.8 && num <= 1.0)) category = RecordCategory.TOP_10;
                else if (num <= 2 || (num < 0.2 && num >= 0)) category = RecordCategory.BOTTOM_10;
            } else {
                const ratingKey = Object.keys(record).find(k => k.toLowerCase().includes('rating') || k.toLowerCase().includes('score'));
                if (ratingKey) {
                    const val = String(record[ratingKey]).toLowerCase();
                    if (val.includes('top') || ['5', '4'].includes(val)) category = RecordCategory.TOP_10;
                    else if (val.includes('bottom') || ['1', '2'].includes(val)) category = RecordCategory.BOTTOM_10;
                }
            }

            // --- Keyword Filtering ---
            if (filterKeywords?.length && !filterKeywords.some(k => content.toLowerCase().includes(k.toLowerCase()))) {
                skippedCount++;
                chunkSkipDetails['Keyword Mismatch'] = (chunkSkipDetails['Keyword Mismatch'] || 0) + 1;
                continue;
            }

            validChunk.push({ record, content, category });
        }

        // 2. DUPLICATE DETECTION (Optimized: Single query per chunk instead of per record)
        // Extract all task IDs from the chunk
        const taskIds = validChunk
            .map(v => v.record.task_id || v.record.id || v.record.uuid || v.record.record_id)
            .filter(id => id != null);

        // Single query to find all existing task IDs in this chunk
        let existingTaskIds: Set<string> = new Set();
        if (taskIds.length > 0) {
            const taskIdStrings = taskIds.map(id => String(id));
            const existing = await prisma.$queryRaw<{
                task_id: string | null;
                id: string | null;
                uuid: string | null;
                record_id: string | null;
            }[]>`
                SELECT
                    metadata->>'task_id' as task_id,
                    metadata->>'id' as id,
                    metadata->>'uuid' as uuid,
                    metadata->>'record_id' as record_id
                FROM public.data_records
                WHERE "projectId" = ${projectId}
                AND type = ${type}::"RecordType"
                AND (
                    metadata->>'task_id' IN (${Prisma.join(taskIdStrings)})
                    OR metadata->>'id' IN (${Prisma.join(taskIdStrings)})
                    OR metadata->>'uuid' IN (${Prisma.join(taskIdStrings)})
                    OR metadata->>'record_id' IN (${Prisma.join(taskIdStrings)})
                )
            `;
            // Add all non-null IDs from all fields to the set
            for (const row of existing) {
                if (row.task_id) existingTaskIds.add(row.task_id);
                if (row.id) existingTaskIds.add(row.id);
                if (row.uuid) existingTaskIds.add(row.uuid);
                if (row.record_id) existingTaskIds.add(row.record_id);
            }
        }

        // Filter out duplicates in memory
        const finalChunk = validChunk.filter(v => {
            const taskId = v.record.task_id || v.record.id || v.record.uuid || v.record.record_id;
            if (!taskId) return true; // No ID to check, allow it

            const isDuplicate = existingTaskIds.has(String(taskId));
            if (isDuplicate) {
                chunkSkipDetails['Duplicate ID'] = (chunkSkipDetails['Duplicate ID'] || 0) + 1;
            }
            return !isDuplicate;
        });

        skippedCount += (validChunk.length - finalChunk.length);

        // Merge details
        Object.entries(chunkSkipDetails).forEach(([reason, count]) => {
            currentDetails[reason] = (currentDetails[reason] || 0) + count;
        });

        await Promise.all(finalChunk.map(v => {
            // Extract timestamps from CSV data
            const createdAtValue = v.record?.created_at || v.record?.createdAt ||
                                  v.record?.timestamp || v.record?.date_created;
            const updatedAtValue = v.record?.updated_at || v.record?.updatedAt ||
                                  v.record?.date_updated || v.record?.modified_at;

            // Parse timestamps if they exist
            const createdAt = createdAtValue ? new Date(createdAtValue) : undefined;
            const updatedAt = updatedAtValue ? new Date(updatedAtValue) : undefined;

            // Validate parsed dates
            const validCreatedAt = createdAt && !isNaN(createdAt.getTime()) ? createdAt : undefined;
            const validUpdatedAt = updatedAt && !isNaN(updatedAt.getTime()) ? updatedAt : undefined;

            return prisma.dataRecord.create({
                data: {
                    projectId,
                    type,
                    category: v.category,
                    source,
                    content: v.content,
                    metadata: typeof v.record === 'object' ? v.record : { value: v.record },
                    // embedding is Unsupported("vector") - defaults to NULL, set via raw SQL in vectorizeJob
                    createdById: v.record?.created_by_id ? String(v.record.created_by_id) : null,
                    createdByName: v.record?.created_by_name ? String(v.record.created_by_name) : null,
                    createdByEmail: v.record?.created_by_email ? String(v.record.created_by_email) : null,
                    ...(validCreatedAt && { createdAt: validCreatedAt }),
                    ...(validUpdatedAt && { updatedAt: validUpdatedAt }),
                }
            });
        }));

        savedCount += finalChunk.length;
        await prisma.ingestJob.update({
            where: { id: jobId },
            data: { savedCount, skippedCount, skippedDetails: currentDetails }
        });
    }

    return { savedCount, skippedCount };
}

export async function cancelIngest(jobId: string) {
    await prisma.ingestJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
    });
}

export async function getIngestStatus(jobId: string) {
    return await prisma.ingestJob.findUnique({
        where: { id: jobId }
    });
}

export async function deleteIngestedData(jobId: string) {
    await prisma.dataRecord.deleteMany({
        where: { metadata: { path: ['ingestJobId'], equals: jobId } }
    });
    await prisma.ingestJob.delete({
        where: { id: jobId }
    });
}
