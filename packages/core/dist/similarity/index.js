import { prisma } from '@repo/database';
import { cosineSimilarity } from '../ai';
import { notifySimilarityDetected } from '../notifications/email-service';
// Parse pgvector string format "[0.1,0.2,...]" to number[]
function parseVector(vectorStr) {
    if (!vectorStr)
        return null;
    if (Array.isArray(vectorStr))
        return vectorStr;
    if (typeof vectorStr === 'string') {
        const inner = vectorStr.slice(1, -1);
        if (!inner)
            return null;
        const values = inner.split(',').map(Number);
        return values.filter(v => !isNaN(v));
    }
    return null;
}
export async function findSimilarRecords(targetId, limit = 5) {
    // Get target record with embedding via raw SQL
    const targetRecords = await prisma.$queryRaw `
    SELECT id, content, environment, type, embedding::text as embedding
    FROM public.data_records
    WHERE id = ${targetId}
    AND embedding IS NOT NULL
  `;
    if (targetRecords.length === 0) {
        throw new Error('Target record not found or has no embedding');
    }
    const targetRecord = targetRecords[0];
    const targetEmbedding = parseVector(targetRecord.embedding);
    if (!targetEmbedding || targetEmbedding.length === 0) {
        throw new Error('Target record has no valid embedding');
    }
    // Use pgvector's built-in similarity search for efficiency
    const similarRecords = await prisma.$queryRaw `
    SELECT
      id,
      content,
      environment,
      type,
      embedding::text as embedding,
      1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${targetId})) as similarity
    FROM public.data_records
    WHERE id != ${targetId}
    AND embedding IS NOT NULL
    ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${targetId})
    LIMIT ${limit}
  `;
    return similarRecords.map(record => ({
        record: {
            id: record.id,
            content: record.content,
            environment: record.environment,
            type: record.type,
        },
        similarity: Number(record.similarity)
    }));
}
/**
 * Starts a background similarity detection job for newly ingested records.
 * Creates a SimilarityJob record, fires runSimilarityDetection() asynchronously,
 * and returns the job ID immediately.
 */
export async function startSimilarityDetection(ingestJobId, environment) {
    const job = await prisma.$queryRaw `
    INSERT INTO public.similarity_jobs (ingest_job_id, environment, status)
    VALUES (${ingestJobId}, ${environment}, 'PENDING')
    RETURNING id
  `;
    const jobId = job[0].id;
    // Fire and forget — detection runs in background after ingest completes
    runSimilarityDetection(jobId, ingestJobId, environment).catch(err => {
        console.error(`[SimilarityDetection] Unhandled error in runSimilarityDetection for job ${jobId} (ingestJob=${ingestJobId}, env=${environment}):`, err);
    });
    return jobId;
}
/**
 * Core similarity detection worker. Compares newly ingested TASK records
 * (from this ingest job) against each user's historical TASK records.
 * Pairs with cosine similarity >= SIMILARITY_THRESHOLD are flagged.
 */
async function runSimilarityDetection(jobId, ingestJobId, environment) {
    const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.80');
    if (isNaN(threshold) || threshold <= 0 || threshold > 1) {
        throw new Error(`Invalid SIMILARITY_THRESHOLD="${process.env.SIMILARITY_THRESHOLD ?? '(not set)'}". Must be a number between 0 and 1 (e.g. 0.80).`);
    }
    try {
        await prisma.$executeRaw `
      UPDATE public.similarity_jobs
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `;
        // Fetch the most recent version of each TASK from this ingest job.
        // If the batch contains multiple versions of the same task (same task_id / task_key),
        // only the newest one is checked — avoids redundant flags for the same prompt.
        const newRecords = await prisma.$queryRaw `
      WITH ranked AS (
        SELECT
          id, content, embedding::text AS embedding,
          "createdByEmail" AS created_by_email,
          "createdByName" AS created_by_name,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              NULLIF(metadata->>'task_id', ''),
              NULLIF(metadata->>'task_key', ''),
              id
            )
            ORDER BY "createdAt" DESC
          ) AS rn
        FROM public.data_records
        WHERE "ingestJobId" = ${ingestJobId}
        AND type = 'TASK'
        AND embedding IS NOT NULL
        AND "createdByEmail" IS NOT NULL
      )
      SELECT id, content, embedding, created_by_email, created_by_name
      FROM ranked
      WHERE rn = 1
    `;
        if (newRecords.length === 0) {
            await prisma.$executeRaw `
        UPDATE public.similarity_jobs
        SET status = 'COMPLETED', records_checked = 0, flags_found = 0, updated_at = NOW()
        WHERE id = ${jobId}::uuid
      `;
            console.log(`[SimilarityDetection] Job ${jobId}: no eligible records found, completed.`);
            return;
        }
        // Group new records by user email
        const byUser = new Map();
        for (const record of newRecords) {
            const key = record.created_by_email;
            if (!byUser.has(key))
                byUser.set(key, []);
            byUser.get(key).push(record);
        }
        const allFlags = [];
        let totalChecked = 0;
        for (const [userEmail, userNewRecords] of byUser) {
            // Collect IDs of newly ingested records to exclude from historical set
            const newIds = userNewRecords.map(r => r.id);
            // Fetch the most recent version of each historical TASK for this user.
            // "Most recent" is defined by ingest_jobs.created_at (when the import ran),
            // not the record's own createdAt (which comes from CSV data and can predate newer imports).
            // Falls back to record createdAt for legacy records with no ingestJobId.
            const historicalRecords = await prisma.$queryRaw `
        WITH ranked AS (
          SELECT
            dr.id, dr.content, dr.embedding::text AS embedding,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(dr.metadata->>'task_id', ''),
                NULLIF(dr.metadata->>'task_key', ''),
                dr.id
              )
              ORDER BY COALESCE(ij."createdAt", dr."createdAt") DESC
            ) AS rn
          FROM public.data_records dr
          LEFT JOIN public.ingest_jobs ij ON ij.id = dr."ingestJobId"
          WHERE dr."createdByEmail" = ${userEmail}
          AND dr.type = 'TASK'
          AND dr.embedding IS NOT NULL
          AND dr."ingestJobId" IS DISTINCT FROM ${ingestJobId}
          AND dr.id != ALL(${newIds}::text[])
        )
        SELECT id, content, embedding
        FROM ranked
        WHERE rn = 1
      `;
            if (historicalRecords.length === 0)
                continue;
            // Parse historical embeddings upfront
            const historical = historicalRecords
                .map(r => ({ id: r.id, content: r.content, vec: parseVector(r.embedding) }))
                .filter(r => r.vec !== null);
            // Compare each new record against all historical records
            for (const newRec of userNewRecords) {
                const newVec = parseVector(newRec.embedding);
                if (!newVec)
                    continue;
                totalChecked++;
                for (const hist of historical) {
                    // Skip identical content
                    if (newRec.content.trim() === hist.content.trim())
                        continue;
                    const score = cosineSimilarity(newVec, hist.vec);
                    if (isNaN(score) || !isFinite(score))
                        continue;
                    if (score >= threshold) {
                        allFlags.push({
                            similarityJobId: jobId,
                            sourceRecordId: newRec.id,
                            matchedRecordId: hist.id,
                            similarityScore: score,
                            userEmail,
                            userName: newRec.created_by_name ?? null,
                            environment,
                            matchType: 'USER_HISTORY',
                        });
                    }
                }
            }
        }
        // Second pass: compare new records against daily great task records
        const dailyGreatRecords = await prisma.$queryRaw `
      SELECT id, content, embedding::text AS embedding
      FROM public.data_records
      WHERE is_daily_great = true
      AND type = 'TASK'
      AND embedding IS NOT NULL
    `;
        if (dailyGreatRecords.length > 0) {
            const parsedGreat = dailyGreatRecords
                .map(r => ({ id: r.id, content: r.content, vec: parseVector(r.embedding) }))
                .filter(r => r.vec !== null);
            for (const newRec of newRecords) {
                const newVec = parseVector(newRec.embedding);
                if (!newVec)
                    continue;
                for (const great of parsedGreat) {
                    // Skip identical content
                    if (newRec.content.trim() === great.content.trim())
                        continue;
                    const score = cosineSimilarity(newVec, great.vec);
                    if (isNaN(score) || !isFinite(score))
                        continue;
                    if (score >= threshold) {
                        allFlags.push({
                            similarityJobId: jobId,
                            sourceRecordId: newRec.id,
                            matchedRecordId: great.id,
                            similarityScore: score,
                            userEmail: newRec.created_by_email,
                            userName: newRec.created_by_name ?? null,
                            environment,
                            matchType: 'DAILY_GREAT',
                        });
                    }
                }
            }
        }
        // Batch-insert flags (ON CONFLICT DO NOTHING for idempotency).
        // Insert one at a time but tolerate individual failures so a single transient
        // error doesn't abort the entire batch.
        let insertedCount = 0;
        for (const flag of allFlags) {
            try {
                await prisma.$executeRaw `
          INSERT INTO public.similarity_flags
            (similarity_job_id, source_record_id, matched_record_id, similarity_score, user_email, user_name, environment, match_type)
          VALUES
            (${flag.similarityJobId}::uuid, ${flag.sourceRecordId}, ${flag.matchedRecordId},
             ${flag.similarityScore}, ${flag.userEmail}, ${flag.userName}, ${flag.environment}, ${flag.matchType})
          ON CONFLICT (source_record_id, matched_record_id, match_type) DO NOTHING
        `;
                insertedCount++;
            }
            catch (insertErr) {
                console.error(`[SimilarityDetection] Job ${jobId}: failed to insert flag (source=${flag.sourceRecordId}, matched=${flag.matchedRecordId}):`, insertErr);
            }
        }
        await prisma.$executeRaw `
      UPDATE public.similarity_jobs
      SET status = 'COMPLETED', records_checked = ${totalChecked}, flags_found = ${insertedCount}, updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `;
        console.log(`[SimilarityDetection] Job ${jobId} completed: checked=${totalChecked}, flags=${allFlags.length}`);
        if (insertedCount > 0) {
            notifySimilarityDetected({
                jobId,
                environment,
                flagCount: insertedCount,
                flags: allFlags.map(f => ({
                    userName: f.userName ?? undefined,
                    userEmail: f.userEmail,
                    similarityScore: f.similarityScore,
                    matchType: f.matchType,
                })),
            }).catch(err => console.error('[SimilarityDetection] Notification error:', err));
        }
    }
    catch (err) {
        console.error(`[SimilarityDetection] Job ${jobId} (ingestJob=${ingestJobId}, env=${environment}) failed:`, err);
        try {
            await prisma.$executeRaw `
        UPDATE public.similarity_jobs
        SET status = 'FAILED', error = ${err.message ?? String(err)}, updated_at = NOW()
        WHERE id = ${jobId}::uuid
      `;
        }
        catch (updateErr) {
            console.error(`[SimilarityDetection] CRITICAL: Failed to mark job ${jobId} as FAILED. Job is stuck in PROCESSING. Update error:`, updateErr);
        }
    }
}
