
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processAndStore } from '../ingestion';
import { RecordType, RecordCategory } from '@prisma/client';

// Mock Prisma using vi.hoisted to ensure accessibility inside vi.mock factory
const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            ingestJob: {
                findUnique: vi.fn(),
                update: vi.fn(),
                create: vi.fn(),
            },
            dataRecord: {
                findFirst: vi.fn(),
                create: vi.fn(),
                findMany: vi.fn(),
                update: vi.fn(),
            },
            $queryRaw: vi.fn(),
        }
    };
});

vi.mock('../prisma', () => ({
    prisma: mockPrisma,
}));

// Mock AI to avoid real API calls
vi.mock('../ai', () => ({
    getEmbeddings: vi.fn().mockResolvedValue([]),
    getEmbedding: vi.fn().mockResolvedValue([]),
}));


describe('Ingestion Logic', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('processAndStore', () => {
        const mockJobId = 'job-123';
        const mockProjectId = 'project-abc';

        it('should ingest valid records and call prisma.create', async () => {
            const records = [{ content: 'Valid content', rating: 'top 10' }];
            const options = {
                projectId: mockProjectId,
                source: 'csv',
                type: RecordType.TASK,
                filterKeywords: [],
                generateEmbeddings: false
            };

            mockPrisma.ingestJob.findUnique.mockResolvedValue({ status: 'PROCESSING', skippedDetails: {} });
            mockPrisma.$queryRaw.mockResolvedValue([]); // No duplicates

            const res = await processAndStore(records, options, mockJobId);

            expect(res.savedCount).toBe(1);
            expect(res.skippedCount).toBe(0);
            expect(mockPrisma.dataRecord.create).toHaveBeenCalledTimes(1);
        });

        it('should skip records with duplicated IDs', async () => {
            const records = [{ task_id: 'dup-1', content: 'Duplicate content', rating: 'top 10' }];
            const options = {
                projectId: mockProjectId,
                source: 'csv',
                type: RecordType.TASK,
                filterKeywords: [],
                generateEmbeddings: false
            };

            mockPrisma.ingestJob.findUnique.mockResolvedValue({ status: 'PROCESSING', skippedDetails: {} });
            // Mock $queryRaw to return a duplicate record
            mockPrisma.$queryRaw.mockResolvedValue([{ id: 'existing-rec' }]);

            const res = await processAndStore(records, options, mockJobId);

            expect(res.savedCount).toBe(0);
            expect(res.skippedCount).toBe(1);
            expect(mockPrisma.dataRecord.create).not.toHaveBeenCalled();

            // detailed check
            expect(mockPrisma.ingestJob.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    skippedDetails: expect.objectContaining({ 'Duplicate ID': 1 })
                })
            }));
        });


        it('should skip records that DO NOT match filter keywords', async () => {
            const records = [{ content: 'This is a public record', rating: 'top 10' }];
            const options = {
                projectId: mockProjectId,
                source: 'csv',
                type: RecordType.TASK,
                filterKeywords: ['secret'], // Must contain 'secret'
                generateEmbeddings: false
            };

            mockPrisma.ingestJob.findUnique.mockResolvedValue({ status: 'PROCESSING', skippedDetails: {} });
            mockPrisma.$queryRaw.mockResolvedValue([]); // No duplicates

            const res = await processAndStore(records, options, mockJobId);

            expect(res.savedCount).toBe(0);
            expect(res.skippedCount).toBe(1);
            expect(mockPrisma.ingestJob.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    skippedDetails: expect.objectContaining({ 'Keyword Mismatch': 1 })
                })
            }));
        });
    });
});
