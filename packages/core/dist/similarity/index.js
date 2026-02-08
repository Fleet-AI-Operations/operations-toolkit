import { prisma } from '@repo/database';
// Parse pgvector string format "[0.1,0.2,...]" to number[]
function parseVector(vectorStr) {
    if (!vectorStr)
        return [];
    const inner = vectorStr.slice(1, -1); // Remove [ and ]
    if (!inner)
        return [];
    return inner.split(',').map(Number);
}
export async function findSimilarRecords(targetId, limit = 5) {
    // Get target record with embedding via raw SQL
    const targetRecords = await prisma.$queryRaw `
    SELECT id, content, "projectId", type, embedding::text as embedding
    FROM public.data_records
    WHERE id = ${targetId}
    AND embedding IS NOT NULL
  `;
    if (targetRecords.length === 0) {
        throw new Error('Target record not found or has no embedding');
    }
    const targetRecord = targetRecords[0];
    const targetEmbedding = parseVector(targetRecord.embedding);
    if (targetEmbedding.length === 0) {
        throw new Error('Target record has no valid embedding');
    }
    // Use pgvector's built-in similarity search for efficiency
    const similarRecords = await prisma.$queryRaw `
    SELECT
      id,
      content,
      "projectId",
      type,
      embedding::text as embedding,
      1 - (embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${targetId})) as similarity
    FROM public.data_records
    WHERE id != ${targetId}
    AND embedding IS NOT NULL
    ORDER BY embedding <=> (SELECT embedding FROM public.data_records WHERE id = ${targetId})
    LIMIT ${limit}
  `;
    return similarRecords.map(record => ({
        record: {
            id: record.id,
            content: record.content,
            projectId: record.projectId,
            type: record.type,
        },
        similarity: Number(record.similarity)
    }));
}
