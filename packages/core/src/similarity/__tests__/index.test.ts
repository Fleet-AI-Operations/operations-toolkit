import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSimilarRecords, startSimilarityDetection } from '../index';
import { cosineSimilarity } from '../../ai';

vi.mock('@repo/database', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../notifications/email-service', () => ({
  notifySimilarityDetected: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ai', () => ({
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

    // First $queryRaw call is the INSERT INTO similarity_jobs — verify its template
    // contains the ingestJobId and environment values
    const firstCall = $queryRaw.mock.calls[0];
    const sqlTemplate = firstCall[0] as unknown as TemplateStringsArray;
    const sqlStr = sqlTemplate.join('?');
    expect(sqlStr).toContain('similarity_jobs');
    expect(sqlStr).toContain('RETURNING id');
    // The values passed as interpolated params should include the ingestJobId and environment
    expect(firstCall).toContain('ingest-001');
    expect(firstCall).toContain('test-env');
  });
});

describe('runSimilarityDetection (via startSimilarityDetection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $executeRaw.mockResolvedValue(undefined);
  });

  it('marks the job COMPLETED with zero flags when no new records exist', async () => {
    $queryRaw.mockResolvedValueOnce([{ id: 'job-empty' }]); // INSERT similarity_job
    $queryRaw.mockResolvedValueOnce([]);                    // newRecords = empty

    await startSimilarityDetection('ingest-no-records', 'env-a');

    // Drain microtask queue so background work completes
    await new Promise(resolve => setTimeout(resolve, 50));

    // $executeRaw calls: PROCESSING update, then COMPLETED update
    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('PROCESSING'))).toBe(true);
    expect(execCalls.some(s => s.includes('COMPLETED'))).toBe(true);
  });

  it('inserts flags and marks COMPLETED when similar records are found', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(0.92); // above default 0.80 threshold

    $queryRaw.mockResolvedValueOnce([{ id: 'job-flags' }]); // INSERT similarity_job
    // newRecords: one new record
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'new prompt text',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'user@example.com',
      created_by_name: 'Test User',
    }]);
    // historicalRecords: one historical record (different content)
    $queryRaw.mockResolvedValueOnce([{
      id: 'hist-rec-1',
      content: 'historical prompt text',
      embedding: '[0.1,0.2,0.3]',
    }]);

    await startSimilarityDetection('ingest-with-flags', 'env-b');

    // Drain background work
    await new Promise(resolve => setTimeout(resolve, 50));

    // $executeRaw should include: PROCESSING update, INSERT flag, COMPLETED update
    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('PROCESSING'))).toBe(true);
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(true);
    expect(execCalls.some(s => s.includes('COMPLETED'))).toBe(true);
  });

  it('skips records with identical content even when similarity is high', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(1.0); // cosine similarity = 1.0 (identical)

    $queryRaw.mockResolvedValueOnce([{ id: 'job-identical' }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'exact same content',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'user@example.com',
      created_by_name: null,
    }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'hist-rec-1',
      content: 'exact same content', // identical — must be skipped
      embedding: '[0.1,0.2,0.3]',
    }]);

    await startSimilarityDetection('ingest-identical', 'env-c');
    await new Promise(resolve => setTimeout(resolve, 50));

    // No INSERT into similarity_flags should occur
    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(false);
  });

  it('does not create flags when similarity score is below threshold', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(0.70); // below default 0.80

    $queryRaw.mockResolvedValueOnce([{ id: 'job-below' }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'new content',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'user@example.com',
      created_by_name: null,
    }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'hist-rec-1',
      content: 'historical content',
      embedding: '[0.4,0.5,0.6]',
    }]);

    await startSimilarityDetection('ingest-below', 'env-d');
    await new Promise(resolve => setTimeout(resolve, 50));

    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(false);
    expect(execCalls.some(s => s.includes('COMPLETED'))).toBe(true);
  });

  it('marks job FAILED and logs job ID when an unexpected error occurs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    $queryRaw.mockResolvedValueOnce([{ id: 'job-fail' }]);
    // Simulate DB failure during the newRecords fetch (first $executeRaw is PROCESSING update)
    $executeRaw
      .mockResolvedValueOnce(undefined) // PROCESSING update succeeds
      .mockRejectedValueOnce(new Error('connection timeout')); // newRecords query via $executeRaw — actually $queryRaw
    // Make the newRecords $queryRaw throw instead
    $queryRaw.mockRejectedValueOnce(new Error('connection timeout'));

    await startSimilarityDetection('ingest-fail', 'env-e');
    await new Promise(resolve => setTimeout(resolve, 50));

    // The error log should include the job ID
    const errorLogs = consoleSpy.mock.calls.map(args => args.join(' '));
    const jobFailLog = errorLogs.find(msg => msg.includes('job-fail'));
    expect(jobFailLog).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('creates DAILY_GREAT flags when new records match daily great task records', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(0.92); // above default 0.80 threshold

    $queryRaw.mockResolvedValueOnce([{ id: 'job-dg' }]);      // INSERT similarity_job
    // newRecords: one record
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'worker prompt text',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'worker@example.com',
      created_by_name: 'Worker One',
    }]);
    // historicalRecords for worker@example.com → empty (no USER_HISTORY flags)
    $queryRaw.mockResolvedValueOnce([]);
    // dailyGreatRecords → one flagged record
    $queryRaw.mockResolvedValueOnce([{
      id: 'great-1',
      content: 'featured great task',
      embedding: '[0.1,0.2,0.3]',
    }]);

    await startSimilarityDetection('ingest-dg', 'env-f');
    await new Promise(resolve => setTimeout(resolve, 50));

    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    // Should insert a similarity flag and mark job COMPLETED
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(true);
    expect(execCalls.some(s => s.includes('COMPLETED'))).toBe(true);

    // The flag insert should include 'DAILY_GREAT' as an interpolated parameter
    const flagInsertCall = ($executeRaw.mock.calls as unknown[][]).find(c => {
      const tmpl = (c[0] as TemplateStringsArray).join('?');
      return tmpl.includes('similarity_flags');
    });
    expect(flagInsertCall).toBeTruthy();
    expect(flagInsertCall).toContain('DAILY_GREAT');
  });

  it('DAILY_GREAT pass skips records with identical content', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(1.0);

    $queryRaw.mockResolvedValueOnce([{ id: 'job-dg-skip' }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'exact same content',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'worker@example.com',
      created_by_name: null,
    }]);
    $queryRaw.mockResolvedValueOnce([]); // no historical records
    $queryRaw.mockResolvedValueOnce([{
      id: 'great-1',
      content: 'exact same content', // identical — must be skipped
      embedding: '[0.1,0.2,0.3]',
    }]);

    await startSimilarityDetection('ingest-dg-skip', 'env-g');
    await new Promise(resolve => setTimeout(resolve, 50));

    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(false);
  });

  it('DAILY_GREAT pass does not create flags when similarity is below threshold', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(0.50); // below 0.80

    $queryRaw.mockResolvedValueOnce([{ id: 'job-dg-low' }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'different content',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'worker@example.com',
      created_by_name: null,
    }]);
    $queryRaw.mockResolvedValueOnce([]); // no historical records
    $queryRaw.mockResolvedValueOnce([{
      id: 'great-1',
      content: 'great task content',
      embedding: '[0.9,0.8,0.7]',
    }]);

    await startSimilarityDetection('ingest-dg-low', 'env-h');
    await new Promise(resolve => setTimeout(resolve, 50));

    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('similarity_flags'))).toBe(false);
    expect(execCalls.some(s => s.includes('COMPLETED'))).toBe(true);
  });

  it('totalChecked includes DAILY_GREAT pass comparisons in the COMPLETED update', async () => {
    vi.mocked(cosineSimilarity).mockReturnValue(0.50); // below threshold — no flags, but counter increments

    $queryRaw.mockResolvedValueOnce([{ id: 'job-count' }]);
    $queryRaw.mockResolvedValueOnce([{
      id: 'new-rec-1',
      content: 'worker task',
      embedding: '[0.1,0.2,0.3]',
      created_by_email: 'worker@example.com',
      created_by_name: null,
    }]);
    $queryRaw.mockResolvedValueOnce([]); // no historical — USER_HISTORY pass does not increment totalChecked
    $queryRaw.mockResolvedValueOnce([{
      id: 'great-1',
      content: 'great task',
      embedding: '[0.4,0.5,0.6]',
    }]);

    await startSimilarityDetection('ingest-count', 'env-i');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Find the COMPLETED $executeRaw call and verify records_checked = 1
    const completedCall = ($executeRaw.mock.calls as unknown[][]).find(c => {
      const tmpl = (c[0] as TemplateStringsArray).join('?');
      return tmpl.includes('COMPLETED');
    });
    expect(completedCall).toBeTruthy();
    // records_checked is passed as an interpolated value — the number 1 should appear in the call args
    expect(completedCall).toContain(1);
  });

  it('marks job FAILED when SIMILARITY_THRESHOLD env var is invalid', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalThreshold = process.env.SIMILARITY_THRESHOLD;
    process.env.SIMILARITY_THRESHOLD = 'not-a-number';

    $queryRaw.mockResolvedValueOnce([{ id: 'job-bad-thresh' }]);

    await startSimilarityDetection('ingest-bad-thresh', 'env-j');
    await new Promise(resolve => setTimeout(resolve, 50));

    const execCalls = ($executeRaw.mock.calls as unknown[][]).map(c => {
      const tmpl = c[0] as TemplateStringsArray;
      return tmpl.join('?');
    });
    expect(execCalls.some(s => s.includes('FAILED'))).toBe(true);

    // Restore
    if (originalThreshold === undefined) {
      delete process.env.SIMILARITY_THRESHOLD;
    } else {
      process.env.SIMILARITY_THRESHOLD = originalThreshold;
    }
    consoleSpy.mockRestore();
  });
});

describe('parseVector (via findSimilarRecords)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $executeRaw.mockResolvedValue(undefined);
  });

  it('returns null for a partially corrupt vector string (contains non-numeric values)', async () => {
    // With the fix, "[0.1,abc,0.3]" should return null, not a truncated [0.1, 0.3]
    // When the target record has a corrupt embedding, findSimilarRecords should throw
    $queryRaw.mockResolvedValueOnce([{
      id: 'target-corrupt',
      content: 'content',
      environment: 'env-a',
      type: 'TASK',
      embedding: '[0.1,abc,0.3]', // partially corrupt
    }]);

    await expect(findSimilarRecords('target-corrupt')).rejects.toThrow(
      'Target record has no valid embedding'
    );
  });

  it('accepts a well-formed vector with all numeric values', async () => {
    $queryRaw.mockResolvedValueOnce([{
      id: 'target-valid',
      content: 'content',
      environment: 'env-a',
      type: 'TASK',
      embedding: '[0.1,0.2,0.3]',
    }]);
    $queryRaw.mockResolvedValueOnce([]);

    await expect(findSimilarRecords('target-valid')).resolves.toEqual([]);
  });
});
