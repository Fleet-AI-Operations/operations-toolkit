import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

/**
 * DEBUG: Check environment distribution in database
 */
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get count of records per environment (from environment column)
        const environmentCounts = await prisma.$queryRaw<{
            environment: string | null;
            count: bigint;
        }[]>`
            SELECT environment, COUNT(*) as count
            FROM data_records
            GROUP BY environment
            ORDER BY count DESC
        `;

        // Get count of records per environment_name (from metadata)
        const metadataEnvCounts = await prisma.$queryRaw<{
            metadata_env: string | null;
            count: bigint;
        }[]>`
            SELECT
                metadata->>'environment_name' as metadata_env,
                COUNT(*) as count
            FROM data_records
            WHERE metadata->>'environment_name' IS NOT NULL
            GROUP BY metadata->>'environment_name'
            ORDER BY count DESC
            LIMIT 20
        `;

        // Get distinct environments using Prisma
        const distinctEnvironments = await prisma.dataRecord.findMany({
            select: { environment: true },
            distinct: ['environment'],
            orderBy: { environment: 'asc' }
        });

        return NextResponse.json({
            environmentCounts: environmentCounts.map(r => ({
                environment: r.environment,
                count: Number(r.count)
            })),
            metadataEnvCounts: metadataEnvCounts.map(r => ({
                metadata_env: r.metadata_env,
                count: Number(r.count)
            })),
            distinctEnvironments: distinctEnvironments.map(r => r.environment),
            summary: {
                totalDistinctInColumn: distinctEnvironments.length,
                totalDistinctInMetadata: metadataEnvCounts.length
            }
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        return NextResponse.json({ error: 'Failed to fetch environment data' }, { status: 500 });
    }
}
