import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cosineSimilarity } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface RecordWithEmbedding {
    id: string;
    content: string;
    createdById: string | null;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: Date;
    embedding: string; // pgvector returns as string
}

interface RedZonePair {
    prompt1: {
        id: string;
        content: string;
        createdByName: string | null;
        createdByEmail: string | null;
        createdAt: Date;
    };
    prompt2: {
        id: string;
        content: string;
        createdByName: string | null;
        createdByEmail: string | null;
        createdAt: Date;
    };
    similarity: number;
}

// Parse pgvector string format "[0.1,0.2,...]" to number[]
function parseVector(vectorStr: string): number[] {
    if (!vectorStr) return [];
    const inner = vectorStr.slice(1, -1); // Remove [ and ]
    if (!inner) return [];
    return inner.split(',').map(Number);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const threshold = parseInt(searchParams.get('threshold') || '70', 10);

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Fetch all TASK records with embeddings using raw SQL
        const records: RecordWithEmbedding[] = await prisma.$queryRaw`
            SELECT
                id,
                content,
                "createdById",
                "createdByName",
                "createdByEmail",
                "createdAt",
                embedding::text as embedding
            FROM public.data_records
            WHERE "projectId" = ${projectId}
            AND type = 'TASK'
            AND embedding IS NOT NULL
        `;

        const redZonePairs: RedZonePair[] = [];
        const seenPairs = new Set<string>();

        // Parse embeddings
        const recordsWithParsedEmbeddings = records.map(r => ({
            ...r,
            parsedEmbedding: parseVector(r.embedding)
        })).filter(r => r.parsedEmbedding.length > 0);

        // Compare all pairs (O(n^2) but necessary for finding all matches)
        for (let i = 0; i < recordsWithParsedEmbeddings.length; i++) {
            for (let j = i + 1; j < recordsWithParsedEmbeddings.length; j++) {
                const record1 = recordsWithParsedEmbeddings[i];
                const record2 = recordsWithParsedEmbeddings[j];

                // Create a unique key for this pair to avoid duplicates
                const pairKey = [record1.id, record2.id].sort().join('-');
                if (seenPairs.has(pairKey)) continue;
                seenPairs.add(pairKey);

                const similarity = cosineSimilarity(
                    record1.parsedEmbedding,
                    record2.parsedEmbedding
                );

                const similarityPercent = Math.round(similarity * 100);

                if (similarityPercent >= threshold) {
                    redZonePairs.push({
                        prompt1: {
                            id: record1.id,
                            content: record1.content,
                            createdByName: record1.createdByName,
                            createdByEmail: record1.createdByEmail,
                            createdAt: record1.createdAt,
                        },
                        prompt2: {
                            id: record2.id,
                            content: record2.content,
                            createdByName: record2.createdByName,
                            createdByEmail: record2.createdByEmail,
                            createdAt: record2.createdAt,
                        },
                        similarity: similarityPercent,
                    });
                }
            }
        }

        // Sort by similarity descending
        redZonePairs.sort((a, b) => b.similarity - a.similarity);

        return NextResponse.json({
            pairs: redZonePairs,
            totalPrompts: recordsWithParsedEmbeddings.length,
            redZoneCount: redZonePairs.length,
        });
    } catch (error: unknown) {
        console.error('Error finding red zone prompts:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to find red zone prompts', details: message },
            { status: 500 }
        );
    }
}
