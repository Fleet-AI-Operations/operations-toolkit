import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbeddings } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface SimilarRecord {
    id: string;
    content: string;
    category: string | null;
    source: string;
    metadata: unknown;
    createdAt: Date;
    similarity: number;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const selectedRecordId = searchParams.get('recordId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        if (!selectedRecordId) {
            return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
        }

        // Get selected record info (without embedding - use raw SQL for that)
        const selectedRecord = await prisma.dataRecord.findUnique({
            where: { id: selectedRecordId },
            select: {
                id: true,
                content: true,
                createdByEmail: true,
                createdById: true,
                createdByName: true,
            },
        });

        if (!selectedRecord) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const userId = selectedRecord.createdById;

        if (!userId) {
            return NextResponse.json({ error: 'Selected record has no user ID' }, { status: 400 });
        }

        // Check if selected record has embedding via raw SQL
        const embeddingCheck: { has_embedding: boolean }[] = await prisma.$queryRaw`
            SELECT embedding IS NOT NULL as has_embedding
            FROM public.data_records
            WHERE id = ${selectedRecordId}
        `;

        let queryEmbedding: number[] | null = null;

        if (!embeddingCheck[0]?.has_embedding) {
            // Generate embedding for selected record
            const freshEmbedding = await getEmbeddings([selectedRecord.content]);

            if (!freshEmbedding || freshEmbedding.length === 0 || !freshEmbedding[0]) {
                return NextResponse.json({ error: 'Failed to generate embedding for selected prompt' }, { status: 500 });
            }

            queryEmbedding = freshEmbedding[0];

            // Save the embedding
            if (queryEmbedding.length > 0) {
                const vectorString = `[${queryEmbedding.join(',')}]`;
                await prisma.$executeRaw`
                    UPDATE public.data_records
                    SET embedding = ${vectorString}::vector
                    WHERE id = ${selectedRecordId}
                `;
            }
        }

        // Use pgvector's cosine distance for similarity search
        const similarPrompts: SimilarRecord[] = queryEmbedding
            ? await prisma.$queryRaw`
                SELECT
                    id,
                    content,
                    category,
                    source,
                    metadata,
                    "createdAt",
                    ROUND((1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector)) * 100) as similarity
                FROM public.data_records
                WHERE "projectId" = ${projectId}
                AND type = 'TASK'
                AND "createdById" = ${userId}
                AND id != ${selectedRecordId}
                AND embedding IS NOT NULL
                ORDER BY embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector
                LIMIT 50
            `
            : await prisma.$queryRaw`
                SELECT
                    id,
                    content,
                    category,
                    source,
                    metadata,
                    "createdAt",
                    ROUND((1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${selectedRecordId}))) * 100) as similarity
                FROM public.data_records
                WHERE "projectId" = ${projectId}
                AND type = 'TASK'
                AND "createdById" = ${userId}
                AND id != ${selectedRecordId}
                AND embedding IS NOT NULL
                ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${selectedRecordId})
                LIMIT 50
            `;

        return NextResponse.json({
            selectedRecord: {
                id: selectedRecord.id,
                content: selectedRecord.content,
                createdByEmail: selectedRecord.createdByEmail,
                createdByName: selectedRecord.createdByName,
            },
            similarPrompts: similarPrompts.map(r => ({
                ...r,
                similarity: Number(r.similarity)
            })),
        });
    } catch (error: unknown) {
        console.error('Error calculating similarity:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to calculate similarity', details: message },
            { status: 500 }
        );
    }
}
