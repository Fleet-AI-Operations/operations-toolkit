import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { Prisma } from '@prisma/client';
import { cosineSimilarity } from '@repo/core/ai';

export const dynamic = 'force-dynamic';

// Parse vector from PostgreSQL format (could be string like "[0.1,0.2,0.3]" or array)
function parseVector(embedding: any): number[] | null {
    if (!embedding) return null;

    if (Array.isArray(embedding)) {
        return embedding;
    }

    if (typeof embedding === 'string') {
        try {
            // Remove brackets and split by comma
            const cleaned = embedding.replace(/[\[\]]/g, '');
            const values = cleaned.split(',').map(v => parseFloat(v.trim()));
            return values.filter(v => !isNaN(v));
        } catch (e) {
            console.error('[ERROR] Failed to parse vector string:', e);
            return null;
        }
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user has FLEET or higher role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !['FLEET', 'ADMIN'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { projectId, taskIds, scope } = await req.json();

        if (!projectId || !taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
        }

        if (scope !== 'environment' && scope !== 'all') {
            return NextResponse.json({ error: 'Invalid scope. Must be "environment" or "all"' }, { status: 400 });
        }

        // Fetch selected tasks with their embeddings
        const selectedTasks = await prisma.$queryRaw<Array<{
            id: string;
            content: string;
            metadata: any;
            embedding: number[] | null;
            createdByName: string | null;
            createdByEmail: string | null;
            createdAt: Date;
        }>>`
            SELECT id, content, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
            FROM data_records
            WHERE id = ANY(${taskIds}::text[])
            AND "projectId" = ${projectId}
            AND type = 'TASK'
            AND embedding IS NOT NULL
        `;

        if (selectedTasks.length === 0) {
            return NextResponse.json({
                error: 'No valid tasks found with embeddings. Tasks must have embeddings to compare similarity.'
            }, { status: 400 });
        }

        const results = [];

        // For each selected task, find similar tasks
        for (const sourceTask of selectedTasks) {
            const environment = (sourceTask.metadata as any)?.environment_name || 'N/A';

            // Build query to fetch comparison tasks
            let comparisonQuery;
            if (scope === 'environment') {
                // Compare within same environment
                comparisonQuery = Prisma.sql`
                    SELECT id, content, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
                    FROM data_records
                    WHERE "projectId" = ${projectId}
                    AND type = 'TASK'
                    AND id != ${sourceTask.id}
                    AND embedding IS NOT NULL
                    AND metadata->>'environment_name' = ${environment}
                `;
            } else {
                // Compare with all tasks in project
                comparisonQuery = Prisma.sql`
                    SELECT id, content, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
                    FROM data_records
                    WHERE "projectId" = ${projectId}
                    AND type = 'TASK'
                    AND id != ${sourceTask.id}
                    AND embedding IS NOT NULL
                `;
            }

            const comparisonTasks = await prisma.$queryRaw<Array<{
                id: string;
                content: string;
                metadata: any;
                embedding: number[] | null;
                createdByName: string | null;
                createdByEmail: string | null;
                createdAt: Date;
            }>>(comparisonQuery);

            // Calculate similarities
            const matches = [];

            // Parse source embedding
            const sourceEmbedding = parseVector(sourceTask.embedding);
            if (!sourceEmbedding) continue;

            for (const compareTask of comparisonTasks) {
                // Skip the source task itself (check both ID and content)
                if (compareTask.id === sourceTask.id) {
                    console.log('[SKIP] ID match detected:', compareTask.id);
                    continue;
                }

                // Skip if content is identical (handles duplicate records)
                if (compareTask.content.trim() === sourceTask.content.trim()) {
                    console.log('[SKIP] Identical content detected - likely duplicate record');
                    console.log('  Source ID:', sourceTask.id, 'Compare ID:', compareTask.id);
                    continue;
                }

                if (!compareTask.embedding) continue;

                // Parse comparison embedding
                const compareEmbedding = parseVector(compareTask.embedding);
                if (!compareEmbedding) continue;

                const similarity = cosineSimilarity(sourceEmbedding, compareEmbedding);
                const similarityPercent = similarity * 100;

                // Check for invalid values
                if (isNaN(similarityPercent) || !isFinite(similarityPercent)) continue;

                // Only include matches with similarity >= 50%
                if (similarityPercent >= 50) {
                    const compareEnv = (compareTask.metadata as any)?.environment_name || 'N/A';
                    matches.push({
                        taskId: compareTask.id,
                        content: compareTask.content,
                        environment: compareEnv,
                        createdBy: compareTask.createdByName || compareTask.createdByEmail || 'Unknown',
                        similarity: similarityPercent,
                        createdAt: compareTask.createdAt.toISOString()
                    });
                }
            }

            // Sort matches by similarity (highest first)
            matches.sort((a, b) => b.similarity - a.similarity);

            results.push({
                sourceTaskId: sourceTask.id,
                sourceContent: sourceTask.content,
                matches
            });
        }

        return NextResponse.json({ results });
    } catch (error: any) {
        console.error('Error comparing prompts:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
