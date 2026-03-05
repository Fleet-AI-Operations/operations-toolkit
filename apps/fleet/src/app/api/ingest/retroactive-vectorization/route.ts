import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/retroactive-vectorization
 *
 * Creates vectorization jobs for all environments that have records without embeddings.
 * This is useful when data was imported directly into the database, bypassing the
 * normal ingestion pipeline.
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user has FLEET or ADMIN role
    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true }
    });

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden - FLEET or ADMIN role required' }, { status: 403 });
    }

    try {
        console.log('🔍 Finding environments with missing embeddings...');

        // Get environments that have records without embeddings
        const environmentsWithMissingEmbeddings = await prisma.$queryRaw<Array<{
            environment: string;
            total: bigint;
            missing: bigint;
        }>>`
            SELECT
                environment,
                COUNT(*) as total,
                COUNT(*) - COUNT(embedding) as missing
            FROM data_records
            GROUP BY environment
            HAVING COUNT(*) - COUNT(embedding) > 0
            ORDER BY environment
        `;

        if (environmentsWithMissingEmbeddings.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All records already have embeddings!',
                jobsCreated: 0
            });
        }

        console.log(`Found ${environmentsWithMissingEmbeddings.length} environments with missing embeddings`);

        // Create a QUEUED_FOR_VEC job for each environment
        const jobs = [];
        for (const env of environmentsWithMissingEmbeddings) {
            // Check if there's already a pending/processing/vectorizing job for this environment
            const existingJob = await prisma.ingestJob.findFirst({
                where: {
                    environment: env.environment,
                    status: { in: ['PENDING', 'PROCESSING', 'QUEUED_FOR_VEC', 'VECTORIZING'] }
                }
            });

            if (existingJob) {
                console.log(`  ⏭ Skipping ${env.environment} - already has active job ${existingJob.id}`);
                continue;
            }

            const job = await prisma.ingestJob.create({
                data: {
                    environment: env.environment,
                    type: 'TASK', // Doesn't matter for vectorization
                    status: 'QUEUED_FOR_VEC',
                    payload: null, // No payload needed for retroactive vectorization
                    options: {
                        source: 'retroactive-vectorization',
                        generateEmbeddings: true
                    },
                    totalRecords: Number(env.total),
                    savedCount: Number(env.total)
                }
            });

            console.log(`  ✓ Created job ${job.id} for ${env.environment}`);
            jobs.push({
                jobId: job.id,
                environment: env.environment,
                recordsToVectorize: Number(env.missing)
            });
        }

        if (jobs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All environments already have active vectorization jobs',
                jobsCreated: 0
            });
        }

        console.log(`🚀 Starting vectorization for ${jobs.length} environments...`);
        // Processing is triggered by the Supabase DB webhook on ingest_jobs INSERT.

        return NextResponse.json({
            success: true,
            message: `Created ${jobs.length} vectorization jobs`,
            jobsCreated: jobs.length,
            jobs
        });

    } catch (error: any) {
        console.error('Error triggering retroactive vectorization:', error);
        return NextResponse.json({
            error: 'Failed to trigger vectorization',
            details: error.message
        }, { status: 500 });
    }
}
