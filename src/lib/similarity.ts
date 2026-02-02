import { prisma } from './prisma';
import { cosineSimilarity } from './ai';
import { hasValidEmbedding } from './embedding-utils';

export async function findSimilarRecords(targetId: string, limit: number = 5) {
    const targetRecord = await prisma.dataRecord.findUnique({
        where: { id: targetId },
    });

    if (!targetRecord || !hasValidEmbedding(targetRecord.embedding)) {
        throw new Error('Target record not found or has no embedding');
    }

    // If we were using pgvector, we'd do a raw query here.
    // Since we are using JSON/Float[] in JS for now, we'll pull records and sort.
    // NOTE: This is NOT efficient for large datasets, but works for a demo.
    // TODO: Implement pgvector raw query if scale increases.

    const allRecords = await prisma.dataRecord.findMany({
        where: {
            id: { not: targetId },
        },
    });

    // Filter out records without embeddings
    const recordsWithEmbeddings = allRecords.filter(r => hasValidEmbedding(r.embedding));

    const results = recordsWithEmbeddings.map(record => ({
        record,
        similarity: cosineSimilarity(targetRecord.embedding, record.embedding)
    }));

    return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}
