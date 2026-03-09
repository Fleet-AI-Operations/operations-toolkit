import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// ── Auth mock helpers ──────────────────────────────────────────────────────

function makeAuthClient(role = 'CORE') {
  return {
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'user-1', email: 'admin@example.com' } }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: { role }, error: null })),
        })),
      })),
    })),
  };
}

vi.mock('@repo/auth/server', () => ({ createClient: vi.fn() }));

vi.mock('@repo/database', () => ({
  prisma: {
    dataRecord: { findMany: vi.fn() },
    promptAuthenticityRecord: { findMany: vi.fn() },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeDataRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'rec-1',
    content: 'Write a story about a robot.',
    environment: 'prod',
    metadata: {},
    createdByEmail: 'worker@example.com',
    createdByName: 'Alice Worker',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    ...overrides,
  };
}

function makeAnalysisRecord(overrides: Record<string, any> = {}) {
  return {
    prompt: 'Write a story about a robot.',
    isLikelyAIGenerated: false,
    aiGeneratedConfidence: 10,
    aiGeneratedIndicators: [],
    isLikelyTemplated: false,
    templateConfidence: 5,
    templateIndicators: [],
    detectedTemplate: null,
    isLikelyNonNative: false,
    nonNativeConfidence: 8,
    nonNativeIndicators: [],
    overallAssessment: 'Looks authentic.',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/prompt-authenticity/user-deep-dive', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient() as any);
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([makeDataRecord()] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([makeAnalysisRecord()] as any);
  });

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
    } as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=w@example.com'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient('QA') as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=w@example.com'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when email param is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/i);
  });

  it('returns 403 for @fleet.so email', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=ops@fleet.so'));
    expect(res.status).toBe(403);
  });

  it('returns empty task list when user has no records', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=nobody@example.com'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(0);
    expect(data.summary.total).toBe(0);
  });

  it('merges analysis results onto tasks', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks[0].analysisStatus).toBe('COMPLETED');
    expect(data.tasks[0].overallAssessment).toBe('Looks authentic.');
  });

  it('marks tasks with no analysis as PENDING', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.tasks[0].analysisStatus).toBe('PENDING');
    expect(data.summary.analyzed).toBe(0);
  });

  it('deduplicates tasks sharing the same task_key, keeping latest', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'rec-old', metadata: { task_key: 'task-abc' }, createdAt: new Date('2026-01-01T09:00:00Z') }),
      makeDataRecord({ id: 'rec-new', metadata: { task_key: 'task-abc' }, createdAt: new Date('2026-01-02T09:00:00Z') }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe('rec-new');
  });

  it('flags rapid submissions within 5 minutes of each other', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'r1', createdAt: new Date('2026-01-10T10:00:00Z') }),
      makeDataRecord({ id: 'r2', createdAt: new Date('2026-01-10T10:03:00Z') }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.tasks[0].isRapidSubmission).toBe(true);
    expect(data.tasks[1].isRapidSubmission).toBe(true);
    expect(data.summary.rapidSubmissionCount).toBe(2);
  });

  it('does not flag submissions more than 5 minutes apart', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'r1', createdAt: new Date('2026-01-10T10:00:00Z') }),
      makeDataRecord({ id: 'r2', createdAt: new Date('2026-01-10T10:10:00Z') }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.tasks[0].isRapidSubmission).toBe(false);
    expect(data.tasks[1].isRapidSubmission).toBe(false);
    expect(data.summary.rapidSubmissionCount).toBe(0);
  });

  it('does not flag submissions exactly 5 minutes apart (boundary — strict less-than)', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'r1', createdAt: new Date('2026-01-10T10:00:00Z') }),
      makeDataRecord({ id: 'r2', createdAt: new Date('2026-01-10T10:05:00Z') }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.tasks[0].isRapidSubmission).toBe(false);
    expect(data.tasks[1].isRapidSubmission).toBe(false);
    expect(data.summary.rapidSubmissionCount).toBe(0);
  });

  it('filters by environment when provided', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.dataRecord.findMany);

    await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com&environment=staging'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ environment: 'staging' }) })
    );
  });

  it('returns correct summary percentages', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'r1' }),
      makeDataRecord({ id: 'r2', content: 'Another prompt.' }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([
      makeAnalysisRecord({ isLikelyAIGenerated: true, aiGeneratedConfidence: 90 }),
    ] as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    const data = await res.json();
    expect(data.summary.total).toBe(2);
    expect(data.summary.aiGeneratedCount).toBe(1);
    expect(data.summary.aiGeneratedPct).toBe(50);
  });

  it('returns 500 on database error', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockRejectedValue(new Error('DB connection lost'));

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('returns 500 (not 403) when the profile fetch fails', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(() => ({ data: { user: { id: 'user-1', email: 'admin@example.com' } }, error: null })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: new Error('profiles table unreachable') })),
          })),
        })),
      })),
    } as any);

    const res = await GET(new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive?email=worker@example.com'));
    expect(res.status).toBe(500);
  });
});
