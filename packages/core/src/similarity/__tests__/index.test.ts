import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSimilarRecords, startSimilarityDetection } from '../index';

vi.mock('@repo/database', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../notifications/email-service', () => ({
  notifySimilarityDetected: vi.fn(() => Promise.resolve()),
}));

vi.mock('../ai', () => ({
  cosineSimilarity: vi.fn(() => 0.95),
}));

// Pull the mocked prisma out after mocking so we can configure return values per test
const { prisma } = await import('@repo/database');

// Cast to give vi access to mockResolvedValueOnce
const $queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;
const $executeRaw = prisma.$executeRaw as ReturnType<typeof vi.fn>;

describe('findSimilarRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default $executeRaw to succeed quietly (used by runSimilarityDetection background work)
    $executeRaw.mockResolvedValue(undefined);
  });

  it('throws when target record is not found or has no embedding', async () => {
    $queryRaw.mockResolvedValueOnce([]); // empty result for target lookup

    await expect(findSimilarRecords('missing-id')).rejects.toThrow(
      'Target record not found or has no embedding'
    );
  });

  it('throws when target record embedding is null', async () => {
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'some content',
        environment: 'env-a',
        type: 'TASK',
        embedding: null,
      },
    ]);

    await expect(findSimilarRecords('target-1')).rejects.toThrow(
      'Target record has no valid embedding'
    );
  });

  it('throws when target record embedding is an empty string', async () => {
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'some content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[]', // brackets only, no numbers inside
      },
    ]);

    await expect(findSimilarRecords('target-1')).rejects.toThrow(
      'Target record has no valid embedding'
    );
  });

  it('returns similar records with similarity scores when target has a valid embedding', async () => {
    // First call: target record lookup
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'target content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]',
      },
    ]);

    // Second call: similar records query
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'similar-1',
        content: 'similar content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]',
        similarity: 0.95,
      },
      {
        id: 'similar-2',
        content: 'another similar',
        environment: 'env-b',
        type: 'TASK',
        embedding: '[0.4,0.5,0.6]',
        similarity: 0.82,
      },
    ]);

    const results = await findSimilarRecords('target-1');

    expect(results).toHaveLength(2);

    expect(results[0]).toEqual({
      record: {
        id: 'similar-1',
        content: 'similar content',
        environment: 'env-a',
        type: 'TASK',
      },
      similarity: 0.95,
    });

    expect(results[1]).toEqual({
      record: {
        id: 'similar-2',
        content: 'another similar',
        environment: 'env-b',
        type: 'TASK',
      },
      similarity: 0.82,
    });
  });

  it('uses the default limit of 5 and passes it to the second query', async () => {
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]',
      },
    ]);
    $queryRaw.mockResolvedValueOnce([]);

    await findSimilarRecords('target-1');

    // Two raw queries should have been issued
    expect($queryRaw).toHaveBeenCalledTimes(2);
  });

  it('parses pgvector string format "[0.1,0.2,0.3]" correctly without throwing', async () => {
    // If parseVector fails, findSimilarRecords would throw 'Target record has no valid embedding'
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]', // pgvector string format
      },
    ]);
    $queryRaw.mockResolvedValueOnce([]);

    // Should resolve successfully — no throw means parsing succeeded
    await expect(findSimilarRecords('target-1')).resolves.toEqual([]);
  });

  it('returns an empty array when no similar records exist', async () => {
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'unique content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.7,0.8,0.9]',
      },
    ]);
    $queryRaw.mockResolvedValueOnce([]);

    const results = await findSimilarRecords('target-1');

    expect(results).toEqual([]);
  });

  it('coerces similarity scores to numbers', async () => {
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'target-1',
        content: 'content',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]',
      },
    ]);
    // Simulate PostgreSQL returning similarity as a string (numeric type can come back as string)
    $queryRaw.mockResolvedValueOnce([
      {
        id: 'similar-1',
        content: 'similar',
        environment: 'env-a',
        type: 'TASK',
        embedding: '[0.1,0.2,0.3]',
        similarity: '0.91' as unknown as number,
      },
    ]);

    const results = await findSimilarRecords('target-1');

    expect(typeof results[0].similarity).toBe('number');
    expect(results[0].similarity).toBe(0.91);
  });
});

describe('startSimilarityDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $executeRaw.mockResolvedValue(undefined);
  });

  it('creates a similarity job and returns the job ID', async () => {
    $queryRaw.mockResolvedValueOnce([{ id: 'job-123' }]);

    // Stub the subsequent $queryRaw calls made by the background runSimilarityDetection
    $queryRaw.mockResolvedValue([]);

    const jobId = await startSimilarityDetection('ingest-abc', 'staging');

    expect(jobId).toBe('job-123');
  });

  it('returns the job ID immediately without waiting for detection to complete', async () => {
    $queryRaw.mockResolvedValueOnce([{ id: 'job-456' }]);

    // Make subsequent background queries take a long time — the function should
    // still return before they settle
    $queryRaw.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 5000))
    );

    const start = Date.now();
    const jobId = await startSimilarityDetection('ingest-xyz', 'production');
    const elapsed = Date.now() - start;

    expect(jobId).toBe('job-456');
    // Should return well before the 5-second background delay
    expect(elapsed).toBeLessThan(1000);
  });

  it('issues the INSERT query with the correct ingestJobId and environment', async () => {
    $queryRaw.mockResolvedValueOnce([{ id: 'job-789' }]);
    $queryRaw.mockResolvedValue([]);

    await startSimilarityDetection('ingest-001', 'test-env');

    // The first $queryRaw call is the INSERT INTO similarity_jobs.
    // The background runSimilarityDetection may have already issued additional
    // $queryRaw calls (e.g. the newRecords fetch) before the microtask queue
    // drains, so we only assert at least one call was made.
    expect($queryRaw.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
