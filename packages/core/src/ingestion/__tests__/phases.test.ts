import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPhase1, runPhase2 } from '../index';

vi.mock('@repo/database', () => ({
    prisma: {
        $executeRaw: vi.fn(),
        ingestJob: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
    Prisma: {
        sql: vi.fn(),
    },
}));

vi.mock('../../ai', () => ({
    getEmbeddings: vi.fn(),
    cosineSimilarity: vi.fn(),
}));

vi.mock('../../similarity', () => ({
    startSimilarityDetection: vi.fn(() => Promise.resolve()),
}));

const { prisma } = await import('@repo/database');
const $executeRaw = prisma.$executeRaw as ReturnType<typeof vi.fn>;
const findUnique = prisma.ingestJob.findUnique as ReturnType<typeof vi.fn>;
const update = prisma.ingestJob.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// runPhase1
// ---------------------------------------------------------------------------

describe('runPhase1', () => {
    it('is a no-op when CAS returns 0 (job already claimed)', async () => {
        $executeRaw.mockResolvedValueOnce(0);

        await runPhase1('job-123');

        expect(findUnique).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('marks job FAILED when options are missing', async () => {
        $executeRaw.mockResolvedValueOnce(1);
        findUnique.mockResolvedValueOnce({ environment: 'prod', type: 'TASK', options: null });

        await runPhase1('job-123');

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'job-123' },
                data: expect.objectContaining({ status: 'FAILED' }),
            })
        );
    });

    it('marks job FAILED and rethrows on unexpected error', async () => {
        const boom = new Error('DB exploded');
        $executeRaw.mockResolvedValueOnce(1);
        findUnique.mockResolvedValueOnce({
            environment: 'prod',
            type: 'TASK',
            options: { source: 'csv', ingestionType: 'CSV' },
        });
        // Second findUnique (payload fetch) throws
        findUnique.mockRejectedValueOnce(boom);

        await expect(runPhase1('job-123')).rejects.toThrow('DB exploded');

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'job-123' },
                data: expect.objectContaining({ status: 'FAILED', error: 'DB exploded' }),
            })
        );
    });
});

// ---------------------------------------------------------------------------
// runPhase2
// ---------------------------------------------------------------------------

describe('runPhase2', () => {
    it('is a no-op when CAS returns 0 (job already claimed)', async () => {
        $executeRaw.mockResolvedValueOnce(0);

        await runPhase2('job-456', 'prod');

        expect(findUnique).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('marks job FAILED and rethrows on unexpected error', async () => {
        const boom = new Error('AI service down');
        $executeRaw.mockResolvedValueOnce(1);
        // vectorizeJob internally calls findUnique; make it throw
        findUnique.mockRejectedValueOnce(boom);

        await expect(runPhase2('job-456', 'prod')).rejects.toThrow('AI service down');

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'job-456' },
                data: expect.objectContaining({ status: 'FAILED', error: 'AI service down' }),
            })
        );
    });

    it('marks job COMPLETED and triggers similarity detection on success', async () => {
        $executeRaw.mockResolvedValueOnce(1);
        // vectorizeJob fetches records — return empty set so it finishes immediately
        findUnique
            .mockResolvedValueOnce({ id: 'job-456', status: 'VECTORIZING', savedCount: 0, environment: 'prod' })
            // status check before COMPLETED
            .mockResolvedValueOnce({ status: 'VECTORIZING' });

        // Patch the internal DB call that fetches unvectorized records to return none
        const { prisma: db } = await import('@repo/database');
        (db.$executeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        // Make vectorizeJob's internal query return empty (no records to embed)
        const { prisma: db2 } = await import('@repo/database');
        // $queryRaw is used inside vectorizeJob for fetching records
        (db2 as any).$queryRaw = vi.fn().mockResolvedValue([]);

        await runPhase2('job-456', 'prod');

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'COMPLETED' }),
            })
        );

        const { startSimilarityDetection } = await import('../../similarity');
        expect(startSimilarityDetection).toHaveBeenCalledWith('job-456', 'prod');
    });
});
