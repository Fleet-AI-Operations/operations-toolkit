/**
 * Backfill createdByName and createdByEmail from metadata JSON
 *
 * For records ingested before author_name/author_email column mapping was added,
 * the full CSV row is stored in metadata. This script reads those values and
 * populates the dedicated columns.
 *
 * Usage: DATABASE_URL="postgresql://..." npx tsx scripts/backfill-created-by.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const BATCH_SIZE = 20;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
    console.log('Starting createdByName / createdByEmail backfill...\n');

    let totalUpdated = 0;
    let batch = 0;

    while (true) {
        batch++;

        const updated: number = await prisma.$executeRaw`
            UPDATE public.data_records
            SET
                "createdByName"  = metadata->>'author_name',
                "createdByEmail" = metadata->>'author_email'
            WHERE id IN (
                SELECT id FROM public.data_records
                WHERE "createdByName" IS NULL
                AND "createdByEmail" IS NULL
                AND (
                    (metadata->>'author_name'  IS NOT NULL AND metadata->>'author_name'  <> '')
                    OR
                    (metadata->>'author_email' IS NOT NULL AND metadata->>'author_email' <> '')
                )
                LIMIT ${BATCH_SIZE}
            )
        `;

        totalUpdated += updated;
        console.log(`Batch ${batch}: ${updated} rows updated (total: ${totalUpdated})`);

        if (updated === 0) break;

        await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`\nDone. ${totalUpdated} records backfilled.`);
}

main()
    .catch(err => {
        console.error('Backfill failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
