import { prisma } from './prisma';
import { cosineSimilarity } from './ai';

export async function findSimilarRecords(targetId: string, limit: number = 5) {
    const targetRecord = await prisma.dataRecord.findUnique({
        where: { id: targetId },
    });

    if (!targetRecord || !targetRecord.embedding || targetRecord.embedding.length === 0) {
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

    // Filter out records without embeddings (since Prisma doesn't support isEmpty on Float[])
    const recordsWithEmbeddings = allRecords.filter(r => r.embedding && r.embedding.length > 0);

    const results = recordsWithEmbeddings.map(record => ({
        record,
        similarity: cosineSimilarity(targetRecord.embedding, record.embedding)
    }));

    return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}
