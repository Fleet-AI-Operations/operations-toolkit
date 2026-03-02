/**
 * Local Embedding Generator for Production
 *
 * Pulls records without embeddings from the production DB, generates embeddings
 * via OpenRouter, and writes them back directly.
 *
 * This bypasses the server-side vectorization job entirely — useful when the
 * Vercel-hosted job is timing out or failing.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/generate-embeddings-prod.ts
 *
 *   # Scope to one environment:
 *   DATABASE_URL="postgresql://..." ENVIRONMENT="outlook" npx tsx scripts/generate-embeddings-prod.ts
 *
 * Required env vars:
 *   DATABASE_URL        — production Supabase connection string
 *   OPENROUTER_API_KEY  — OpenRouter API key (set permanently via: see README instructions)
 *
 * Optional env vars:
 *   ENVIRONMENT                  — limit to a single environment name
 *   OPENROUTER_EMBEDDING_MODEL   — override model (default: openai/text-embedding-3-small)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 25;
const ENVIRONMENT = process.env.ENVIRONMENT ?? null;

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';

if (!API_KEY) {
    console.error('Error: OPENROUTER_API_KEY is not set.');
    console.error('Set it permanently with: echo \'export OPENROUTER_API_KEY="sk-or-..."\' >> ~/.zshrc && source ~/.zshrc');
    process.exit(1);
}

if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not set.');
    process.exit(1);
}

// ─── DB setup ─────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Embedding ────────────────────────────────────────────────────────────────

async function getEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const sanitized = texts.map(t => t.replace(/\0/g, ' ').trim());

    const res = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: sanitized }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const sorted = (data.data as { index: number; embedding: number[] }[])
        .sort((a, b) => a.index - b.index);

    return sorted.map(d => d.embedding ?? null);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`Model : ${EMBEDDING_MODEL}`);
    console.log(`Scope : ${ENVIRONMENT ?? 'all environments'}`);
    console.log();

    const [{ missing }] = ENVIRONMENT
        ? await prisma.$queryRaw<[{ missing: bigint }]>`
            SELECT COUNT(*) AS missing FROM public.data_records
            WHERE embedding IS NULL
            AND (metadata->>'embeddingError' IS NULL)
            AND environment = ${ENVIRONMENT}
          `
        : await prisma.$queryRaw<[{ missing: bigint }]>`
            SELECT COUNT(*) AS missing FROM public.data_records
            WHERE embedding IS NULL
            AND (metadata->>'embeddingError' IS NULL)
          `;

    const total = Number(missing);

    if (total === 0) {
        console.log('All records already have embeddings.');
        return;
    }

    console.log(`Records needing embeddings: ${total}\n`);

    let processed = 0;
    let failed = 0;
    const startTime = Date.now();

    while (true) {
        const batch: { id: string; content: string }[] = ENVIRONMENT
            ? await prisma.$queryRaw`
                SELECT id, content FROM public.data_records
                WHERE embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                AND environment = ${ENVIRONMENT}
                ORDER BY id ASC
                LIMIT ${BATCH_SIZE}
              `
            : await prisma.$queryRaw`
                SELECT id, content FROM public.data_records
                WHERE embedding IS NULL
                AND (metadata->>'embeddingError' IS NULL)
                ORDER BY id ASC
                LIMIT ${BATCH_SIZE}
              `;

        if (batch.length === 0) break;

        try {
            const embeddings = await getEmbeddings(batch.map(r => r.content));

            for (let i = 0; i < batch.length; i++) {
                const vector = embeddings[i];
                if (!vector || vector.length === 0) {
                    failed++;
                    continue;
                }
                const vectorString = `[${vector.join(',')}]`;
                await prisma.$executeRaw`
                    UPDATE public.data_records
                    SET embedding = ${vectorString}::vector
                    WHERE id = ${batch[i].id}
                `;
                processed++;
            }
        } catch (err: any) {
            if (err.message?.includes('dimensions')) {
                console.error(`\nDimension mismatch: ${err.message}`);
                console.error('The embedding model output size does not match the DB vector column.');
                break;
            }
            console.warn(`\nBatch error (skipping ${batch.length} records): ${err.message}`);
            for (const record of batch) {
                await prisma.$executeRaw`
                    UPDATE public.data_records
                    SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"embeddingError":"Local script batch error"}'::jsonb
                    WHERE id = ${record.id}
                `;
            }
            failed += batch.length;
        }

        const pct = Math.round(((processed + failed) / total) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = rate > 0 ? Math.round((total - processed - failed) / rate) : '?';
        process.stdout.write(
            `\r  ${processed + failed}/${total} (${pct}%)  |  ${processed} embedded  |  ${failed} failed  |  ~${remaining}s remaining  `
        );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\nDone in ${elapsed}s — ${processed} embedded, ${failed} failed.`);
}

main()
    .catch(err => {
        console.error('\nScript failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
