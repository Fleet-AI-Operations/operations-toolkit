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
import { prisma, Prisma } from '@repo/database';
import { getEmbeddings } from '../ai';
import { RecordCategory } from '@repo/types';
/**
 * ENTRY POINT: startBackgroundIngest
 *
 * NOTE: Stores payload and options in database instead of memory for serverless compatibility.
 * Vercel functions are stateless and terminate after sending HTTP response,
 * so in-memory caches don't persist across invocations.
 *
 * Environment and type can be extracted from CSV data if not provided.
 */
export async function startBackgroundIngest(type, payload, options) {
    // For CSV ingestion without explicit environment/type, extract from first row
    let environment = options.environment;
    let recordType = options.type;
    if (!environment || !recordType) {
        try {
            const rows = parse(payload, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });
            if (rows.length > 0) {
                const firstRow = rows[0];
                // Extract environment from common column names
                if (!environment) {
                    environment = firstRow.environment_name ||
                        firstRow.environment ||
                        firstRow.env_key ||
                        firstRow.env ||
                        'default';
                }
                // Extract type from common column names
                if (!recordType) {
                    const typeValue = (firstRow.type || firstRow.record_type || 'TASK').toString().toUpperCase();
                    recordType = (typeValue === 'FEEDBACK' ? 'FEEDBACK' : 'TASK');
                }
            }
            else {
                // Fallback if CSV is empty or can't be parsed
                environment = environment || 'default';
                recordType = recordType || 'TASK';
            }
        }
        catch (error) {
            console.error('Error extracting environment/type from CSV:', error);
            environment = environment || 'default';
            recordType = recordType || 'TASK';
        }
    }
    const job = await prisma.ingestJob.create({
        data: {
            environment: environment,
            type: recordType,
            status: 'PENDING',
            payload: payload, // Store in database for serverless compatibility
            options: {
                ...options,
                environment,
                type: recordType,
                ingestionType: type, // Store whether CSV or API
            },
        }
    });
    // Trigger processing (will be killed in serverless, but status endpoint will re-trigger)
    processQueuedJobs().catch(err => console.error('Queue Processor Error:', err));
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
 *
 * If environment is provided, only processes jobs for that environment.
 * If not provided, processes jobs for all environments.
 */
export async function processQueuedJobs(environment) {
    if (environment) {
        // Process specific environment
        await Promise.allSettled([
            processJobs(environment),
            processVectorizationJobs(environment)
        ]);
    }
    else {
        // Process all environments - get distinct environments from pending/queued jobs
        const environments = await prisma.ingestJob.findMany({
            where: {
                status: { in: ['PENDING', 'QUEUED_FOR_VEC'] }
            },
            select: { environment: true },
            distinct: ['environment']
        });
        // Process each environment's jobs
        await Promise.allSettled(environments.map(({ environment }) => Promise.allSettled([
            processJobs(environment),
            processVectorizationJobs(environment)
        ])));
    }
}
/**
 * QUEUE PROCESSOR: processJobs
 * Manages Phase 1 (Data Loading). This phase can run in parallel with Phase 2 (Vectorizing).
 * However, we still only allow one PROCESSING job per environment to ensure DB write order.
 */
async function processJobs(environment) {
    const activeProcessing = await prisma.ingestJob.findFirst({
        where: { environment, status: 'PROCESSING' }
    });
    if (activeProcessing) {
        // In serverless, we can't rely on memory state, so just return and let the job be picked up later
        return; // Wait for the active data load to finish
    }
    const nextJob = await prisma.ingestJob.findFirst({
        where: { environment, status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
    });
    if (!nextJob)
        return;
    if (!nextJob.payload) {
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: 'Job payload missing from database.' }
        });
        processJobs(environment);
        return;
    }
    if (!nextJob.options) {
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: 'Job options missing from database.' }
        });
        processJobs(environment);
        return;
    }
    // Reconstruct cache object from database-stored payload and options
    const storedOptions = nextJob.options;
    const cache = {
        type: (storedOptions.ingestionType || 'CSV'),
        payload: nextJob.payload,
        options: {
            environment: nextJob.environment,
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
        let records = [];
        if (cache.type === 'CSV') {
            records = parse(cache.payload, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });
        }
        else {
            // API type: payload can be either a URL or direct JSON string
            let data;
            // Try to parse as JSON first (direct JSON payload)
            try {
                data = JSON.parse(cache.payload);
            }
            catch {
                // If parsing fails, treat as URL and fetch
                const response = await fetch(cache.payload);
                data = await response.json();
            }
            records = Array.isArray(data) ? data : [data];
        }
        // Update job with total record count for progress tracking
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { totalRecords: records.length }
        });
        await processAndStore(records, cache.options, nextJob.id);
        // Phase 1 Complete: Mark as queued for vectorization
        if (cache.options.generateEmbeddings) {
            await prisma.ingestJob.update({
                where: { id: nextJob.id },
                data: { status: 'QUEUED_FOR_VEC' }
            });
            // Trigger vectorization queue processor
            processVectorizationJobs(environment).catch(err => console.error('Vectorization Queue Error:', err));
        }
        else {
            // No vectorization needed, mark as complete and clear payload
            await prisma.ingestJob.update({
                where: { id: nextJob.id },
                data: { status: 'COMPLETED', payload: null }
            });
        }
        processJobs(environment);
    }
    catch (error) {
        console.error('[Ingestion] Job failed:', error);
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: error.message, payload: null }
        });
        processJobs(environment);
    }
}
/**
 * VECTORIZATION QUEUE PROCESSOR: processVectorizationJobs
 * Manages Phase 2 (Vectorization). Only one VECTORIZING job per environment is allowed
 * to prevent overloading the AI server.
 */
async function processVectorizationJobs(environment) {
    // Check if there's already a job vectorizing for this environment
    const activeVectorizing = await prisma.ingestJob.findFirst({
        where: { environment, status: 'VECTORIZING' }
    });
    if (activeVectorizing) {
        return; // Wait for active vectorization to finish
    }
    // Get the next job queued for vectorization
    const nextJob = await prisma.ingestJob.findFirst({
        where: { environment, status: 'QUEUED_FOR_VEC' },
        orderBy: { createdAt: 'asc' }
    });
    if (!nextJob)
        return;
    try {
        // Mark as vectorizing
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'VECTORIZING' }
        });
        // Run vectorization
        await vectorizeJob(nextJob.id, environment);
        // Only mark as complete if the job wasn't cancelled during vectorization.
        // vectorizeJob exits early on cancellation but doesn't write the final status itself,
        // so we check here to avoid overwriting a CANCELLED status with COMPLETED.
        const finalJob = await prisma.ingestJob.findUnique({
            where: { id: nextJob.id },
            select: { status: true }
        });
        if (finalJob?.status !== 'CANCELLED') {
            await prisma.ingestJob.update({
                where: { id: nextJob.id },
                data: { status: 'COMPLETED', payload: null }
            });
        }
        // Process next job in queue
        processVectorizationJobs(environment);
    }
    catch (error) {
        console.error('[Vectorization] Job failed:', error);
        await prisma.ingestJob.update({
            where: { id: nextJob.id },
            data: { status: 'FAILED', error: error.message, payload: null }
        });
        processVectorizationJobs(environment);
    }
}
/**
 * Phase 2: Vectorization
 * Iterates through records in the environment that lack embeddings and generates them using the active AI provider.
 *
 * Note: Scoped to the Environment. This serves as a self-healing mechanism: any record in the environment
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
async function vectorizeJob(jobId, environment) {
    const RECORDS_BATCH_SIZE = 50;
    const MAX_RETRIES_PER_RECORD = 3;
    const failedRecordAttempts = new Map(); // Track retry attempts per record
    const permanentlyFailedIds = new Set(); // Track IDs that have been marked as failed
    let totalEmbedded = 0;
    let totalSkipped = 0;
    while (true) {
        // Check for cancellation
        const job = await prisma.ingestJob.findUnique({ where: { id: jobId }, select: { status: true } });
        if (job?.status === 'CANCELLED')
            break;
        // Fetch records that need embeddings (NULL embedding) using raw SQL
        // Exclude permanently failed records to avoid infinite loops
        // Also exclude records that already have embeddingError in metadata
        const failedIdsArray = Array.from(permanentlyFailedIds);
        const batch = failedIdsArray.length > 0
            ? await prisma.$queryRaw `
                SELECT id, content, metadata FROM public.data_records
                WHERE environment = ${environment}
                AND embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                AND id NOT IN (${Prisma.join(failedIdsArray)})
                ORDER BY id ASC
                LIMIT ${RECORDS_BATCH_SIZE}
            `
            : await prisma.$queryRaw `
                SELECT id, content, metadata FROM public.data_records
                WHERE environment = ${environment}
                AND embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                ORDER BY id ASC
                LIMIT ${RECORDS_BATCH_SIZE}
            `;
        if (batch.length === 0)
            break;
        // Separate records by retry status
        const recordsToProcess = [];
        const recordsToSkip = [];
        for (const record of batch) {
            const attempts = failedRecordAttempts.get(record.id) || 0;
            if (attempts >= MAX_RETRIES_PER_RECORD) {
                recordsToSkip.push(record);
            }
            else {
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
        if (recordsToProcess.length === 0)
            continue;
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
                    await prisma.$executeRaw `
                        UPDATE public.data_records
                        SET embedding = ${vectorString}::vector
                        WHERE id = ${record.id}
                    `;
                    batchSuccess++;
                    totalEmbedded++;
                    // Clear from failed attempts on success
                    failedRecordAttempts.delete(record.id);
                }
                catch (error) {
                    // Check for dimension mismatch error
                    if (error.message?.includes('expected') && error.message?.includes('dimensions')) {
                        const dimensionMatch = error.message.match(/expected (\d+) dimensions, not (\d+)/);
                        if (dimensionMatch) {
                            throw new Error(`Vector dimension mismatch: Database expects ${dimensionMatch[1]} dimensions, but embedding model returned ${dimensionMatch[2]} dimensions. ` +
                                `Update the migration: ALTER TABLE public.data_records ALTER COLUMN embedding TYPE vector(${dimensionMatch[2]});`);
                        }
                    }
                    throw error;
                }
            }
            else {
                // Track failed attempt
                const attempts = failedRecordAttempts.get(record.id) || 0;
                failedRecordAttempts.set(record.id, attempts + 1);
            }
        }
        console.log(`[Vectorize] Batch result: ${batchSuccess}/${recordsToProcess.length} successful (total: ${totalEmbedded}, skipped: ${totalSkipped})`);
        // Heartbeat: touch the job's updatedAt so the status endpoint can distinguish
        // an actively-processing job from one that is stuck/zombie (function timed out).
        await prisma.ingestJob.update({
            where: { id: jobId },
            data: { updatedAt: new Date() }
        });
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
 * - Tracks 'Duplicate ID' (existing Task ID or Feedback ID in environment)
 * - Updates `IngestJob.skippedDetails` JSON for UI visibility.
 */
export async function processAndStore(records, options, jobId) {
    const { environment, source, type, filterKeywords } = options;
    // Ensure required fields have defaults
    const actualEnvironment = environment || 'default';
    const actualType = type || 'TASK';
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
        if (currentJob?.status === 'CANCELLED')
            return { savedCount, skippedCount, cancelled: true };
        const currentDetails = currentJob?.skippedDetails || {};
        const chunkSkipDetails = {};
        const validChunk = [];
        // 1. FILTER: Content, Ratings, Keywords
        for (let j = 0; j < chunk.length; j++) {
            const record = chunk[j];
            // --- Type Detection (Per Row) ---
            // Determine the actual type for this specific row based on CSV 'type' column
            // 'prompt' = TASK, 'feedback' = FEEDBACK
            let rowType = actualType; // Default to job-level type
            if (record.type) {
                const csvType = record.type.toLowerCase();
                if (csvType === 'feedback') {
                    rowType = 'FEEDBACK';
                }
                else if (csvType === 'prompt' || csvType === 'task') {
                    rowType = 'TASK';
                }
            }
            else if (record.feedback_id || (record.feedback_content && record.task_prompt)) {
                // QA feedback analysis format: no type column, but feedback-specific fields present
                rowType = 'FEEDBACK';
            }
            // --- Environment Detection (Per Row) ---
            // Extract environment from CSV columns: env_key, environment_name, environment, env
            let rowEnvironment = actualEnvironment; // Default to job-level environment
            if (record.env_key) {
                rowEnvironment = String(record.env_key).trim();
            }
            else if (record.environment_name) {
                rowEnvironment = String(record.environment_name).trim();
            }
            else if (record.environment) {
                rowEnvironment = String(record.environment).trim();
            }
            else if (record.env) {
                rowEnvironment = String(record.env).trim();
            }
            // --- Content Extraction ---
            let content = '';
            if (typeof record === 'string') {
                content = record;
            }
            else {
                // Prefer the field that matches the row's type; fall back to all known content columns
                if (rowType === 'FEEDBACK') {
                    content = record.feedback_content || record.feedback ||
                        record.prompt || record.task_prompt ||
                        record.content || record.body || record.task_content ||
                        record.text || record.message || record.instruction || record.response;
                }
                else {
                    content = record.prompt || record.task_prompt || record.feedback_content || record.feedback ||
                        record.content || record.body || record.task_content ||
                        record.text || record.message || record.instruction || record.response;
                }
                if (!content || content.length < 10) {
                    const textFields = Object.entries(record)
                        .filter(([, val]) => typeof val === 'string' && String(val).length > 10)
                        .sort((a, b) => String(b[1]).length - String(a[1]).length);
                    if (textFields.length > 0)
                        content = String(textFields[0][1]);
                }
                if (!content)
                    content = JSON.stringify(record);
            }
            // --- Rating Detection ---
            let category = RecordCategory.STANDARD; // Default to STANDARD if no rating found
            const ratingValue = record.prompt_quality_rating || record.feedback_quality_rating || record.quality_rating ||
                record.rating || record.category || record.label || record.score || record.avg_score;
            const ratingRaw = (ratingValue || '').toString().toLowerCase().trim();
            if (ratingRaw.includes('top') && (ratingRaw.includes('10')))
                category = RecordCategory.TOP_10;
            else if (ratingRaw.includes('bottom') && (ratingRaw.includes('10')))
                category = RecordCategory.BOTTOM_10;
            else if (['top_10', 'top10', 'top', 'selected', 'better'].includes(ratingRaw))
                category = RecordCategory.TOP_10;
            else if (['bottom_10', 'bottom10', 'bottom', 'rejected', 'worse'].includes(ratingRaw))
                category = RecordCategory.BOTTOM_10;
            else if (!isNaN(parseFloat(ratingRaw)) && ratingRaw !== '') {
                const num = parseFloat(ratingRaw);
                if (num >= 4 || (num > 0.8 && num <= 1.0))
                    category = RecordCategory.TOP_10;
                else if (num <= 2 || (num < 0.2 && num >= 0))
                    category = RecordCategory.BOTTOM_10;
            }
            else {
                const ratingKey = Object.keys(record).find(k => k.toLowerCase().includes('rating') || k.toLowerCase().includes('score'));
                if (ratingKey) {
                    const val = String(record[ratingKey]).toLowerCase();
                    if (val.includes('top') || ['5', '4'].includes(val))
                        category = RecordCategory.TOP_10;
                    else if (val.includes('bottom') || ['1', '2'].includes(val))
                        category = RecordCategory.BOTTOM_10;
                }
            }
            // --- Keyword Filtering ---
            if (filterKeywords?.length && !filterKeywords.some(k => content.toLowerCase().includes(k.toLowerCase()))) {
                chunkSkipDetails['Keyword Mismatch'] = (chunkSkipDetails['Keyword Mismatch'] || 0) + 1;
                continue;
            }
            validChunk.push({ record, content, category, rowType, rowEnvironment });
        }
        // 2. DUPLICATE DETECTION (Optimized: Single query per chunk instead of per record)
        // Extract all task IDs and task keys from the chunk (new CSV format uses task_id and task_key)
        const taskIds = validChunk
            .map(v => v.record.task_id || v.record.feedback_id || v.record.id || v.record.uuid || v.record.record_id)
            .filter(id => id != null);
        const taskKeys = validChunk
            .map(v => v.record.task_key)
            .filter(key => key != null);
        // Single query to find all existing task IDs and keys in this chunk
        // Store as Map<type, Set<id/key>> to handle mixed TASK/FEEDBACK records
        const existingTaskIdsByType = new Map();
        const existingTaskKeysByType = new Map();
        existingTaskIdsByType.set('TASK', new Set());
        existingTaskIdsByType.set('FEEDBACK', new Set());
        existingTaskKeysByType.set('TASK', new Set());
        existingTaskKeysByType.set('FEEDBACK', new Set());
        if (taskIds.length > 0 || taskKeys.length > 0) {
            const taskIdStrings = taskIds.map(id => String(id));
            const taskKeyStrings = taskKeys.map(key => String(key));
            // Build query conditions using Prisma.Sql array
            const conditions = [];
            if (taskIdStrings.length > 0) {
                conditions.push(Prisma.sql `metadata->>'task_id' IN (${Prisma.join(taskIdStrings)})`);
                conditions.push(Prisma.sql `metadata->>'feedback_id' IN (${Prisma.join(taskIdStrings)})`);
                conditions.push(Prisma.sql `metadata->>'id' IN (${Prisma.join(taskIdStrings)})`);
                conditions.push(Prisma.sql `metadata->>'uuid' IN (${Prisma.join(taskIdStrings)})`);
                conditions.push(Prisma.sql `metadata->>'record_id' IN (${Prisma.join(taskIdStrings)})`);
            }
            if (taskKeyStrings.length > 0) {
                conditions.push(Prisma.sql `metadata->>'task_key' IN (${Prisma.join(taskKeyStrings)})`);
            }
            if (conditions.length > 0) {
                const existing = await prisma.$queryRaw `
                    SELECT
                        type,
                        metadata->>'task_id' as task_id,
                        metadata->>'feedback_id' as feedback_id,
                        metadata->>'task_key' as task_key,
                        metadata->>'id' as id,
                        metadata->>'uuid' as uuid,
                        metadata->>'record_id' as record_id
                    FROM public.data_records
                    WHERE environment = ${actualEnvironment}
                    AND (${Prisma.join(conditions, ' OR ')})
                `;
                // Add all non-null IDs and keys to the type-specific sets
                for (const row of existing) {
                    const typeIds = existingTaskIdsByType.get(row.type);
                    const typeKeys = existingTaskKeysByType.get(row.type);
                    if (row.task_id)
                        typeIds.add(row.task_id);
                    if (row.feedback_id)
                        typeIds.add(row.feedback_id);
                    if (row.task_key)
                        typeKeys.add(row.task_key);
                    if (row.id)
                        typeIds.add(row.id);
                    if (row.uuid)
                        typeIds.add(row.uuid);
                    if (row.record_id)
                        typeIds.add(row.record_id);
                }
            }
        }
        // Filter out duplicates in memory (check by type)
        const finalChunk = validChunk.filter(v => {
            const taskId = v.record.task_id || v.record.feedback_id || v.record.id || v.record.uuid || v.record.record_id;
            const taskKey = v.record.task_key;
            if (!taskId && !taskKey)
                return true; // No ID or key to check, allow it
            // Check duplicates against the same type only
            const existingIds = existingTaskIdsByType.get(v.rowType);
            const existingKeys = existingTaskKeysByType.get(v.rowType);
            const isDuplicateById = taskId && existingIds.has(String(taskId));
            const isDuplicateByKey = taskKey && existingKeys.has(String(taskKey));
            const isDuplicate = isDuplicateById || isDuplicateByKey;
            if (isDuplicate) {
                chunkSkipDetails['Duplicate ID'] = (chunkSkipDetails['Duplicate ID'] || 0) + 1;
            }
            return !isDuplicate;
        });
        // Merge details
        Object.entries(chunkSkipDetails).forEach(([reason, count]) => {
            currentDetails[reason] = (currentDetails[reason] || 0) + count;
        });
        await Promise.all(finalChunk.map(v => {
            // Extract timestamps — prefer type-specific columns, fall back to generic ones
            const createdAtValue = v.record?.created_at || v.record?.createdAt ||
                (v.rowType === 'FEEDBACK' ? v.record?.feedback_created_at : v.record?.task_created_at) ||
                v.record?.feedback_created_at || v.record?.task_created_at ||
                v.record?.timestamp || v.record?.date_created;
            const updatedAtValue = v.record?.updated_at || v.record?.updatedAt ||
                v.record?.date_updated || v.record?.modified_at;
            const createdAt = createdAtValue ? new Date(createdAtValue) : undefined;
            const updatedAt = updatedAtValue ? new Date(updatedAtValue) : undefined;
            const validCreatedAt = createdAt && !isNaN(createdAt.getTime()) ? createdAt : undefined;
            const validUpdatedAt = updatedAt && !isNaN(updatedAt.getTime()) ? updatedAt : undefined;
            // Creator fields — support legacy (author_*/created_by_*), new task format
            // (task_creator_*), and new feedback format (rater_*)
            const nameRaw = v.record?.author_name || v.record?.created_by_name ||
                (v.rowType === 'FEEDBACK' ? v.record?.rater_name : v.record?.task_creator_name);
            const emailRaw = v.record?.author_email || v.record?.created_by_email ||
                (v.rowType === 'FEEDBACK' ? v.record?.rater_email : v.record?.task_creator_email);
            return prisma.dataRecord.create({
                data: {
                    environment: v.rowEnvironment,
                    type: v.rowType,
                    category: v.category,
                    source,
                    content: v.content,
                    metadata: typeof v.record === 'object' ? v.record : { value: v.record },
                    // embedding is Unsupported("vector") - defaults to NULL, set via raw SQL in vectorizeJob
                    createdById: v.record?.created_by_id ? String(v.record.created_by_id) : null,
                    createdByName: nameRaw ? String(nameRaw) : null,
                    createdByEmail: emailRaw ? String(emailRaw) : null,
                    ...(validCreatedAt && { createdAt: validCreatedAt }),
                    ...(validUpdatedAt && { updatedAt: validUpdatedAt }),
                }
            });
        }));
        const chunkSaved = finalChunk.length;
        // Calculate total skipped: keyword mismatches + duplicates
        const keywordSkipped = chunk.length - validChunk.length;
        const duplicateSkipped = validChunk.length - finalChunk.length;
        const chunkSkipped = keywordSkipped + duplicateSkipped;
        savedCount += chunkSaved;
        skippedCount += chunkSkipped;
        // Use Prisma's atomic increment to prevent count flickering
        await prisma.ingestJob.update({
            where: { id: jobId },
            data: {
                savedCount: { increment: chunkSaved },
                skippedCount: { increment: chunkSkipped },
                skippedDetails: currentDetails,
                updatedAt: new Date()
            }
        });
    }
    return { savedCount, skippedCount };
}
export async function cancelIngest(jobId) {
    await prisma.ingestJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
    });
}
export async function getIngestStatus(jobId) {
    return await prisma.ingestJob.findUnique({
        where: { id: jobId }
    });
}
export async function deleteIngestedData(jobId) {
    await prisma.dataRecord.deleteMany({
        where: { metadata: { path: ['ingestJobId'], equals: jobId } }
    });
    await prisma.ingestJob.delete({
        where: { id: jobId }
    });
}
