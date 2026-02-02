
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSimilarRecords } from '../similarity';

// Mock Prisma using vi.hoisted to ensure accessibility inside vi.mock factory
const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            dataRecord: {
                findUnique: vi.fn(),
                findMany: vi.fn(),
            },
        }
    };
});

// Mock cosineSimilarity using vi.hoisted
const { mockCosineSimilarity } = vi.hoisted(() => ({
    mockCosineSimilarity: vi.fn(),
}));

vi.mock('../prisma', () => ({
    prisma: mockPrisma,
}));

vi.mock('../ai', () => ({
    cosineSimilarity: mockCosineSimilarity,
}));

describe('Similarity Search', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('findSimilarRecords', () => {
        const mockTargetId = 'target-123';
        const mockTargetEmbedding = [0.1, 0.2, 0.3];

        it('should throw error when target record does not exist', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue(null);

            await expect(findSimilarRecords(mockTargetId)).rejects.toThrow(
                'Target record not found or has no embedding'
            );
        });

        it('should throw error when target record has no embedding', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: null,
            });

            await expect(findSimilarRecords(mockTargetId)).rejects.toThrow(
                'Target record not found or has no embedding'
            );
        });

        it('should throw error when target record has empty embedding array', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: [],
            });

            await expect(findSimilarRecords(mockTargetId)).rejects.toThrow(
                'Target record not found or has no embedding'
            );
        });

        it('should filter out records without embeddings', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            mockPrisma.dataRecord.findMany.mockResolvedValue([
                { id: 'rec-1', embedding: [0.2, 0.3, 0.4] },
                { id: 'rec-2', embedding: null },
                { id: 'rec-3', embedding: [] },
                { id: 'rec-4', embedding: [0.1, 0.1, 0.1] },
            ]);

            mockCosineSimilarity
                .mockReturnValueOnce(0.95)
                .mockReturnValueOnce(0.80);

            const results = await findSimilarRecords(mockTargetId, 5);

            // Should only process records with valid embeddings (rec-1 and rec-4)
            expect(mockCosineSimilarity).toHaveBeenCalledTimes(2);
            expect(results).toHaveLength(2);
        });

        it('should return top N similar records sorted by similarity score', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            mockPrisma.dataRecord.findMany.mockResolvedValue([
                { id: 'rec-1', embedding: [0.2, 0.3, 0.4], content: 'First' },
                { id: 'rec-2', embedding: [0.1, 0.1, 0.1], content: 'Second' },
                { id: 'rec-3', embedding: [0.3, 0.3, 0.3], content: 'Third' },
                { id: 'rec-4', embedding: [0.15, 0.25, 0.35], content: 'Fourth' },
            ]);

            // Return similarity scores in non-sorted order
            mockCosineSimilarity
                .mockReturnValueOnce(0.75) // rec-1
                .mockReturnValueOnce(0.60) // rec-2
                .mockReturnValueOnce(0.95) // rec-3 (highest)
                .mockReturnValueOnce(0.85); // rec-4

            const results = await findSimilarRecords(mockTargetId, 2);

            // Should return top 2 by similarity (rec-3 and rec-4)
            expect(results).toHaveLength(2);
            expect(results[0].record.id).toBe('rec-3');
            expect(results[0].similarity).toBe(0.95);
            expect(results[1].record.id).toBe('rec-4');
            expect(results[1].similarity).toBe(0.85);
        });

        it('should handle limit parameter correctly', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            mockPrisma.dataRecord.findMany.mockResolvedValue([
                { id: 'rec-1', embedding: [0.1, 0.1, 0.1] },
                { id: 'rec-2', embedding: [0.2, 0.2, 0.2] },
                { id: 'rec-3', embedding: [0.3, 0.3, 0.3] },
            ]);

            mockCosineSimilarity
                .mockReturnValueOnce(0.9)
                .mockReturnValueOnce(0.8)
                .mockReturnValueOnce(0.7);

            const results = await findSimilarRecords(mockTargetId, 2);

            expect(results).toHaveLength(2);
        });

        it('should use default limit of 5 when not specified', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            const manyRecords = Array.from({ length: 10 }, (_, i) => ({
                id: `rec-${i}`,
                embedding: [0.1, 0.2, 0.3],
            }));

            mockPrisma.dataRecord.findMany.mockResolvedValue(manyRecords);
            mockCosineSimilarity.mockReturnValue(0.8);

            const results = await findSimilarRecords(mockTargetId);

            expect(results).toHaveLength(5);
        });

        it('should exclude the target record from results', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            // Verify findMany is called with NOT clause
            mockPrisma.dataRecord.findMany.mockResolvedValue([]);

            await findSimilarRecords(mockTargetId);

            expect(mockPrisma.dataRecord.findMany).toHaveBeenCalledWith({
                where: {
                    id: { not: mockTargetId },
                },
            });
        });

        it('should handle empty result set gracefully', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            mockPrisma.dataRecord.findMany.mockResolvedValue([]);

            const results = await findSimilarRecords(mockTargetId, 5);

            expect(results).toHaveLength(0);
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle records with only invalid embeddings', async () => {
            mockPrisma.dataRecord.findUnique.mockResolvedValue({
                id: mockTargetId,
                embedding: mockTargetEmbedding,
            });

            mockPrisma.dataRecord.findMany.mockResolvedValue([
                { id: 'rec-1', embedding: null },
                { id: 'rec-2', embedding: [] },
                { id: 'rec-3', embedding: null },
            ]);

            const results = await findSimilarRecords(mockTargetId, 5);

            expect(results).toHaveLength(0);
            expect(mockCosineSimilarity).not.toHaveBeenCalled();
        });
    });
});
