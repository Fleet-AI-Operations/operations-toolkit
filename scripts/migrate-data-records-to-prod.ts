#!/usr/bin/env tsx
/**
 * Migration Script: Move Data Records to Production
 *
 * Copies data_records from a source database to a target database in batches.
 * Records are scoped by the `environment` string field — no project mapping needed.
 *
 * Before migrating, all existing target IDs are loaded into memory so duplicates
 * are identified upfront and filtered out before any INSERT is attempted.
 * A secondary content-based check skips records whose trimmed content already
 * exists in the target under a different id.
 * ON CONFLICT (id) DO NOTHING is kept as a final safety net.
 *
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://..." \
 *   TARGET_DATABASE_URL="postgresql://..." \
 *   tsx scripts/migrate-data-records-to-prod.ts
 *
 * Optional env vars:
 *   ENVIRONMENT   — migrate only records matching this environment string
 *   DRY_RUN=true  — simulate without writing anything
 *   BATCH_SIZE    — records per INSERT batch (default: 500)
 */

import { Client } from 'pg';
import * as readline from 'readline';

// ============================================================================
// Configuration
// ============================================================================

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL;
const ENVIRONMENT_FILTER = process.env.ENVIRONMENT || null;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

if (isNaN(BATCH_SIZE) || BATCH_SIZE < 1) {
    console.error('❌ BATCH_SIZE must be a positive integer');
    process.exit(1);
}

// Columns to copy. Excludes relation fields (likertScores, assignments, etc.)
// that live in other tables. The `embedding` vector column is included as-is.
const COLUMNS = [
    'id',
    'environment',
    'type',
    'category',
    'source',
    'content',
    'metadata',
    'embedding',
    'hasBeenReviewed',
    'isCategoryCorrect',
    'reviewedBy',
    'alignmentAnalysis',
    'ingestJobId',
    'createdAt',
    'updatedAt',
    'createdById',
    'createdByName',
    'createdByEmail',
];

// ============================================================================
// Validation
// ============================================================================

if (!SOURCE_DATABASE_URL) {
    console.error('❌ SOURCE_DATABASE_URL environment variable is required');
    process.exit(1);
}

if (!TARGET_DATABASE_URL) {
    console.error('❌ TARGET_DATABASE_URL environment variable is required');
    process.exit(1);
}

// ============================================================================
// Helpers
// ============================================================================


async function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

function maskUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.username ? '***:***@' : ''}${parsed.host}${parsed.pathname}`;
    } catch {
        return '***';
    }
}

function makeClient(url: string): Client {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const separator = url.includes('?') ? '&' : '?';
    return new Client({
        connectionString: isLocal ? url : `${url}${separator}sslmode=no-verify`,
        ssl: isLocal ? false : { rejectUnauthorized: false },
    });
}

// ============================================================================
// Migration
// ============================================================================

async function migrate() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Data Records Migration');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📤 Source:       ${maskUrl(SOURCE_DATABASE_URL!)}`);
    console.log(`📥 Target:       ${maskUrl(TARGET_DATABASE_URL!)}`);
    console.log(`🌍 Environment:  ${ENVIRONMENT_FILTER ?? 'ALL'}`);
    console.log(`📦 Batch size:   ${BATCH_SIZE}`);
    console.log(`🧪 Dry run:      ${DRY_RUN ? 'YES (no data will be written)' : 'NO'}`);
    console.log('');

    const source = makeClient(SOURCE_DATABASE_URL!);
    const target = makeClient(TARGET_DATABASE_URL!);

    try {
        console.log('🔌 Connecting to databases...');
        await source.connect();
        await target.connect();
        console.log('✅ Connected');
        console.log('');

        // Count source records
        const sourceCountResult = await source.query(
            ENVIRONMENT_FILTER
                ? `SELECT COUNT(*) FROM public.data_records WHERE environment = $1`
                : `SELECT COUNT(*) FROM public.data_records`,
            ENVIRONMENT_FILTER ? [ENVIRONMENT_FILTER] : []
        );
        const sourceCount = parseInt(sourceCountResult.rows[0].count, 10);

        // Load all existing target IDs upfront so we can filter before inserting.
        // This avoids surprise ON CONFLICT skips and gives an accurate pre-migration
        // breakdown of what is genuinely new.
        console.log('🔍 Loading existing IDs from target...');
        const existingIdsResult = await target.query(
            `SELECT id FROM public.data_records`
        );
        const existingIds = new Set<string>(
            existingIdsResult.rows.map((r: { id: string }) => r.id)
        );
        const targetCountBefore = existingIds.size;

        console.log('');
        console.log(`📊 Source records:        ${sourceCount.toLocaleString()}`);
        console.log(`📊 Target records before: ${targetCountBefore.toLocaleString()}`);
        console.log(`   (ID duplicates will be filtered per-batch using the loaded ID set)`);
        console.log('');

        if (sourceCount === 0) {
            console.log('⚠️  No records found in source. Nothing to do.');
            return;
        }

        // Show environment breakdown from source
        const envBreakdown = await source.query(
            `SELECT environment, COUNT(*) as count
             FROM public.data_records
             ${ENVIRONMENT_FILTER ? 'WHERE environment = $1' : ''}
             GROUP BY environment
             ORDER BY count DESC`,
            ENVIRONMENT_FILTER ? [ENVIRONMENT_FILTER] : []
        );
        console.log('📋 Environments to migrate:');
        for (const row of envBreakdown.rows) {
            console.log(`   ${row.environment}: ${parseInt(row.count).toLocaleString()} records`);
        }
        console.log('');

        if (!DRY_RUN) {
            console.log('⚠️  WARNING: This will INSERT records into the target database!');
            console.log('⚠️  Records with a matching id OR matching content are skipped.');
            console.log('');
            const confirmed = await askConfirmation('❓ Continue? (y/N): ');
            if (!confirmed) {
                console.log('❌ Cancelled');
                return;
            }
            console.log('');
        }

        // Stream records from source in fixed-size pages and insert immediately.
        // Never holds more than BATCH_SIZE records in memory at once.
        const columnList = COLUMNS.map(c => `"${c}"`).join(', ');
        const whereClause = ENVIRONMENT_FILTER ? 'WHERE environment = $1' : '';
        const totalBatches = Math.ceil(sourceCount / BATCH_SIZE);

        console.log(`📦 Processing ${sourceCount.toLocaleString()} records in ${totalBatches} batch${totalBatches === 1 ? '' : 'es'} of ${BATCH_SIZE}...`);
        console.log('');

        let totalInserted = 0;
        let totalIdDupes = 0;
        let totalContentDupes = 0;
        let totalErrors = 0;
        let offset = 0;
        let batchNum = 0;
        const insertStart = Date.now();

        while (offset < sourceCount) {
            batchNum++;
            const progress = ((batchNum / totalBatches) * 100).toFixed(1);

            // Fetch one page — discarded after insert, never accumulates
            const pageResult = await source.query(
                `SELECT ${columnList}
                 FROM public.data_records
                 ${whereClause}
                 ORDER BY id ASC
                 LIMIT $${ENVIRONMENT_FILTER ? 2 : 1} OFFSET $${ENVIRONMENT_FILTER ? 3 : 2}`,
                ENVIRONMENT_FILTER ? [ENVIRONMENT_FILTER, BATCH_SIZE, offset] : [BATCH_SIZE, offset]
            );
            const batch = pageResult.rows;
            if (batch.length === 0) break;

            process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${progress}%): `);

            if (DRY_RUN) {
                const newInBatch = batch.filter(row => !existingIds.has(row.id));
                const idDupesInBatch = batch.length - newInBatch.length;
                totalIdDupes += idDupesInBatch;
                totalInserted += newInBatch.length;
                console.log(`[DRY RUN] would insert ${newInBatch.length}, skip ${idDupesInBatch} id-duplicates`);
                offset += batch.length;
                continue;
            }

            try {
                // Step 1: filter out records whose ID already exists in target
                const afterIdFilter = batch.filter(row => !existingIds.has(row.id));
                const idDupesInBatch = batch.length - afterIdFilter.length;
                totalIdDupes += idDupesInBatch;

                if (afterIdFilter.length === 0) {
                    console.log(`skipped all ${batch.length} (id duplicates)`);
                    offset += batch.length;
                    continue;
                }

                // Step 2: filter out records whose trimmed content already exists in
                // the target under a different id (catches duplicates ON CONFLICT misses)
                const batchContents = afterIdFilter.map(row => (row.content ?? '').trim());
                const existingContentsResult = await target.query(
                    `SELECT TRIM(content) AS content
                     FROM public.data_records
                     WHERE TRIM(content) = ANY($1::text[])`,
                    [batchContents]
                );
                const existingContents = new Set<string>(
                    existingContentsResult.rows.map((r: { content: string }) => r.content)
                );
                const filteredBatch = afterIdFilter.filter(
                    row => !existingContents.has((row.content ?? '').trim())
                );
                const contentDupes = afterIdFilter.length - filteredBatch.length;
                totalContentDupes += contentDupes;

                if (filteredBatch.length === 0) {
                    const note = idDupesInBatch > 0 ? `, ${idDupesInBatch} id dupes` : '';
                    console.log(`skipped all ${batch.length} (${contentDupes} content dupes${note})`);
                    offset += batch.length;
                    continue;
                }

                const placeholders = filteredBatch.map((_, rowIdx) =>
                    `(${COLUMNS.map((_, colIdx) => `$${rowIdx * COLUMNS.length + colIdx + 1}`).join(', ')})`
                ).join(', ');

                const values = filteredBatch.flatMap(row =>
                    COLUMNS.map(col => {
                        const val = row[col];
                        if (col === 'metadata' && val !== null && typeof val === 'object') {
                            return JSON.stringify(val);
                        }
                        return val ?? null;
                    })
                );

                const result = await target.query(
                    `INSERT INTO public.data_records (${columnList})
                     VALUES ${placeholders}
                     ON CONFLICT (id) DO NOTHING`,
                    values
                );

                const inserted = result.rowCount ?? 0;
                totalInserted += inserted;
                const parts = [`inserted ${inserted}`];
                if (idDupesInBatch > 0) parts.push(`${idDupesInBatch} id-dupes`);
                if (contentDupes > 0) parts.push(`${contentDupes} content-dupes`);
                console.log(parts.join(', '));
            } catch (err) {
                totalErrors += batch.length;
                console.log(`❌ Error: ${err instanceof Error ? err.message : err}`);
                console.log('   Continuing with next batch...');
            }

            offset += batch.length;
        }

        const elapsed = ((Date.now() - insertStart) / 1000).toFixed(2);
        const rps = totalInserted > 0 ? Math.round(totalInserted / parseFloat(elapsed)) : 0;

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  Complete');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        console.log(`✅ Inserted:        ${totalInserted.toLocaleString()} records`);
        console.log(`⏭️  ID duplicates:   ${totalIdDupes.toLocaleString()} records`);
        console.log(`🔁 Content dupes:   ${totalContentDupes.toLocaleString()} records`);
        console.log(`❌ Errors:          ${totalErrors.toLocaleString()} records`);
        console.log(`⏱️  Time:       ${elapsed}s (${rps} records/sec)`);
        console.log('');

        if (DRY_RUN) {
            console.log('🧪 DRY RUN — no data was written. Remove DRY_RUN=true to run for real.');
        } else {
            const finalCountResult = await target.query(`SELECT COUNT(*) FROM public.data_records`);
            const targetCountAfter = parseInt(finalCountResult.rows[0].count, 10);
            console.log(`📊 Target records after: ${targetCountAfter.toLocaleString()} (was ${targetCountBefore.toLocaleString()})`);
        }
        console.log('');

        if (totalErrors > 0) {
            process.exitCode = 1;
        }

    } finally {
        await source.end();
        await target.end();
    }
}

migrate().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
