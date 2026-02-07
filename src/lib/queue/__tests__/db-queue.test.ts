import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma using vi.hoisted to ensure accessibility
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      jobQueue: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
        deleteMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocks are set up
import { DatabaseQueue } from '../db-queue';
import type { JobType } from '../db-queue';

describe('DatabaseQueue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('enqueue', () => {
    it('should create a new job with default values', async () => {
      const mockJob = {
        id: 'job-123',
        jobType: 'INGEST_DATA',
        payload: { test: true },
        priority: 0,
        status: 'PENDING',
      };

      mockPrisma.jobQueue.create.mockResolvedValue(mockJob);

      const result = await DatabaseQueue.enqueue({
        jobType: 'INGEST_DATA',
        payload: { test: true },
      });

      expect(result).toEqual(mockJob);
      expect(mockPrisma.jobQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobType: 'INGEST_DATA',
          payload: { test: true },
          priority: 0,
          maxAttempts: 3,
        }),
      });
    });

    it('should respect custom priority and maxAttempts', async () => {
      mockPrisma.jobQueue.create.mockResolvedValue({ id: 'job-123' });

      await DatabaseQueue.enqueue({
        jobType: 'VECTORIZE',
        payload: { projectId: 'proj-1' },
        priority: 5,
        maxAttempts: 10,
      });

      expect(mockPrisma.jobQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 5,
          maxAttempts: 10,
        }),
      });
    });
  });

  describe('claimJob', () => {
    it('should claim the next available job using PostgreSQL function', async () => {
      const mockClaimedJob = {
        job_id: 'job-123',
        job_type: 'INGEST_DATA' as JobType,
        payload: { test: true },
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockClaimedJob]);

      const result = await DatabaseQueue.claimJob(['INGEST_DATA']);

      expect(result).toEqual(mockClaimedJob);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return null when no jobs available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await DatabaseQueue.claimJob(['INGEST_DATA']);

      expect(result).toBeNull();
    });

    it('should support claiming multiple job types', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await DatabaseQueue.claimJob(['INGEST_DATA', 'VECTORIZE']);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('completeJob', () => {
    it('should mark job as completed and clear payload', async () => {
      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      await DatabaseQueue.completeJob('job-123', { savedCount: 100 });

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: { savedCount: 100 },
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('failJob', () => {
    it('should set job back to PENDING when retries remain', async () => {
      mockPrisma.jobQueue.findUnique.mockResolvedValue({
        attempts: 1,
        maxAttempts: 3,
      });

      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      const error = new Error('Test error');
      await DatabaseQueue.failJob('job-123', error);

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'PENDING',
          scheduledFor: expect.any(Date),
        }),
      });
    });

    it('should mark job as FAILED when retries exhausted', async () => {
      mockPrisma.jobQueue.findUnique.mockResolvedValue({
        attempts: 3,
        maxAttempts: 3,
      });

      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      const error = new Error('Test error');
      await DatabaseQueue.failJob('job-123', error);

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      });
    });

    it('should use exponential backoff for retries', async () => {
      mockPrisma.jobQueue.findUnique.mockResolvedValue({
        attempts: 2,
        maxAttempts: 5,
      });

      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      await DatabaseQueue.failJob('job-123', new Error('Test'));

      const updateCall = mockPrisma.jobQueue.update.mock.calls[0][0];
      const scheduledFor = updateCall.data.scheduledFor;

      // Verify backoff exists (should be at least 10 seconds in future)
      const now = new Date();
      expect(scheduledFor.getTime()).toBeGreaterThan(now.getTime() + 10000);
    });
  });

  describe('getQueueStats', () => {
    it('should use groupBy for efficient stats aggregation', async () => {
      mockPrisma.jobQueue.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { status: 5 } },
        { status: 'PROCESSING', _count: { status: 2 } },
        { status: 'COMPLETED', _count: { status: 100 } },
        { status: 'FAILED', _count: { status: 3 } },
      ]);

      const stats = await DatabaseQueue.getQueueStats();

      expect(stats).toEqual({
        pending: 5,
        processing: 2,
        completed: 100,
        failed: 3,
      });

      expect(mockPrisma.jobQueue.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: { status: true },
      });
    });

    it('should return zeros when no jobs exist', async () => {
      mockPrisma.jobQueue.groupBy.mockResolvedValue([]);

      const stats = await DatabaseQueue.getQueueStats();

      expect(stats).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe('cleanup', () => {
    it('should delete old completed and failed jobs', async () => {
      mockPrisma.jobQueue.deleteMany.mockResolvedValue({ count: 50 });

      const count = await DatabaseQueue.cleanup(7);

      expect(count).toBe(50);
      expect(mockPrisma.jobQueue.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should use custom retention days', async () => {
      mockPrisma.jobQueue.deleteMany.mockResolvedValue({ count: 10 });

      await DatabaseQueue.cleanup(30);

      const deleteCall = mockPrisma.jobQueue.deleteMany.mock.calls[0][0];
      const cutoffDate = deleteCall.where.completedAt.lt;
      const daysAgo = Math.floor((Date.now() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysAgo).toBeCloseTo(30, 0);
    });
  });

  describe('retryJob', () => {
    it('should reset job to PENDING state', async () => {
      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      await DatabaseQueue.retryJob('job-123');

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 0,
          startedAt: null,
          completedAt: null,
        }),
      });
    });
  });

  describe('updateProgress', () => {
    it('should update job progress metadata', async () => {
      mockPrisma.jobQueue.update.mockResolvedValue({ id: 'job-123' });

      await DatabaseQueue.updateProgress('job-123', 50, 100, 'Processing records');

      expect(mockPrisma.jobQueue.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          progress: {
            current: 50,
            total: 100,
            message: 'Processing records',
          },
        }),
      });
    });

    it('should not throw on progress update errors', async () => {
      mockPrisma.jobQueue.update.mockRejectedValue(new Error('DB error'));

      await expect(
        DatabaseQueue.updateProgress('job-123', 10, 100)
      ).resolves.not.toThrow();
    });
  });
});
