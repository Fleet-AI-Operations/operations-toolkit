import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));
vi.mock('@repo/database', () => ({
  prisma: {
    taskDispute: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

const ADMIN_USER = { id: 'admin-uuid-1', email: 'admin@example.com', role: 'ADMIN' };

const makeAuthSuccess = () => ({ user: ADMIN_USER, error: null });
const makeAuthError = (status: number) => ({
  error: Response.json({ error: 'Unauthorized' }, { status }) as any,
});

const CSV_HEADER =
  'id,created_at,updated_at,feedback_id,eval_task_id,dispute_status,dispute_reason,' +
  'resolution_reason,resolved_at,report_text,is_helpful,disputer_user_id,disputer_name,' +
  'disputer_email,resolver_user_id,resolver_name,team_id,team_name,task_key,' +
  'task_lifecycle_status,env_key,env_data_key,task_modality,dispute_data,leased_by,lease_expires_at';

const makeCSVRow = (overrides: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {
    id: '1001',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    feedback_id: '500',
    eval_task_id: 'ext-uuid-1',
    dispute_status: 'pending',
    dispute_reason: 'Incorrect feedback',
    resolution_reason: '',
    resolved_at: '',
    report_text: '',
    is_helpful: '',
    disputer_user_id: 'user-ext-1',
    disputer_name: 'Jane Smith',
    disputer_email: 'jane@example.com',
    resolver_user_id: '',
    resolver_name: '',
    team_id: 'team-1',
    team_name: 'Task Designers',
    task_key: 'task_abc123_1234567890_xyz',
    task_lifecycle_status: '',
    env_key: 'fos-accounting',
    env_data_key: '',
    task_modality: 'computer_use',
    dispute_data: '',
    leased_by: '',
    lease_expires_at: '',
    ...overrides,
  };
  return Object.values(defaults).join(',');
};

const makeCSV = (...rows: string[]) =>
  [CSV_HEADER, ...rows].join('\n');

const makeRequest = (csvContent: string, fileSize?: number) => {
  const file = {
    text: () => Promise.resolve(csvContent),
    size: fileSize ?? csvContent.length,
    name: 'disputes.csv',
  };
  const req = new NextRequest('http://localhost:3005/api/task-disputes/import', {
    method: 'POST',
  });
  req.formData = vi.fn().mockResolvedValue({ get: (key: string) => (key === 'file' ? file : null) });
  return req;
};

const makeRequestNoFile = () => {
  const req = new NextRequest('http://localhost:3005/api/task-disputes/import', {
    method: 'POST',
  });
  req.formData = vi.fn().mockResolvedValue({ get: () => null });
  return req;
};

describe('POST /api/task-disputes/import', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.taskDispute.upsert).mockResolvedValue({ id: 'dispute-1' } as any);
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

    const res = await POST(makeRequest(makeCSV()));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin roles', async () => {
    const { requireRole } = await import('@repo/api-utils');
    vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

    const res = await POST(makeRequest(makeCSV()));
    expect(res.status).toBe(403);
  });

  // ── File validation ─────────────────────────────────────────────────────────

  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeRequestNoFile());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no file/i);
  });

  it('returns 400 when file exceeds 50MB', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow()), 51 * 1024 * 1024));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too large/i);
  });

  it('returns 400 when CSV is empty', async () => {
    const res = await POST(makeRequest(CSV_HEADER));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty/i);
  });

  it('returns 400 when CSV cannot be parsed', async () => {
    const res = await POST(makeRequest('not,,valid\x00csv"content'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/parse/i);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with import summary on success', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow())));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary).toMatchObject({
      imported: expect.any(Number),
      updated: expect.any(Number),
      skipped: expect.any(Number),
      matched: expect.any(Number),
      errors: expect.any(Array),
    });
  });

  it('counts new rows as imported', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]); // no existing rows

    const res = await POST(makeRequest(makeCSV(makeCSVRow())));
    const { summary } = await res.json();
    expect(summary.imported).toBe(1);
    expect(summary.updated).toBe(0);
  });

  it('counts existing rows as updated', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([{ externalId: 1001 }] as any);

    const res = await POST(makeRequest(makeCSV(makeCSVRow())));
    const { summary } = await res.json();
    expect(summary.imported).toBe(0);
    expect(summary.updated).toBe(1);
  });

  it('counts matched as 1 when task_key resolves to a data_record (new row only)', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'record-cuid-1', task_key: 'task_abc123_1234567890_xyz' },
    ]);
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]); // new row

    const res = await POST(makeRequest(makeCSV(makeCSVRow())));
    const { summary } = await res.json();
    expect(summary.matched).toBe(1);
  });

  it('does not count matched for updated rows', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: 'record-cuid-1', task_key: 'task_abc123_1234567890_xyz' },
    ]);
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([{ externalId: 1001 }] as any);

    const res = await POST(makeRequest(makeCSV(makeCSVRow())));
    const { summary } = await res.json();
    expect(summary.matched).toBe(0);
    expect(summary.updated).toBe(1);
  });

  it('calls upsert once per valid row', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]);

    const csv = makeCSV(makeCSVRow({ id: '1001' }), makeCSVRow({ id: '1002' }));
    await POST(makeRequest(csv));

    expect(vi.mocked(prisma.taskDispute.upsert)).toHaveBeenCalledTimes(2);
  });

  // ── Row-level validation ────────────────────────────────────────────────────

  it('skips rows with invalid id and records an error', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow({ id: 'not-a-number' }))));
    const { summary } = await res.json();
    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/invalid id/i);
  });

  it('skips rows with missing task_key and records an error', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow({ task_key: '' }))));
    const { summary } = await res.json();
    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/task_key/i);
  });

  it('skips rows with invalid feedback_id and records an error', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow({ feedback_id: 'bad' }))));
    const { summary } = await res.json();
    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/feedback_id/i);
  });

  it('skips rows with invalid created_at and records an error', async () => {
    const res = await POST(makeRequest(makeCSV(makeCSVRow({ created_at: 'not-a-date' }))));
    const { summary } = await res.json();
    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/date/i);
  });

  it('processes is_helpful True/False correctly', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]);

    await POST(makeRequest(makeCSV(makeCSVRow({ is_helpful: 'True' }))));

    const upsertCall = vi.mocked(prisma.taskDispute.upsert).mock.calls[0][0];
    expect(upsertCall.create.isHelpful).toBe(true);
  });

  it('sets evalTaskId to null when task_key has no matching data_record', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]); // no matches
    vi.mocked(prisma.taskDispute.findMany).mockResolvedValue([]);

    await POST(makeRequest(makeCSV(makeCSVRow())));

    const upsertCall = vi.mocked(prisma.taskDispute.upsert).mock.calls[0][0];
    expect(upsertCall.create.evalTaskId).toBeNull();
  });
});
