import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// ── Auth mock helpers ──────────────────────────────────────────────────────

function makeAuthClient(role = 'FLEET') {
  return {
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'user-1' } }, error: null })),
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
    promptAuthenticityRecord: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@repo/core', () => ({
  analyzePromptAuthenticity: vi.fn(),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeDataRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'rec-1',
    content: 'Write a story about a robot.',
    environment: 'prod',
    metadata: {},
    createdByName: 'Alice',
    createdByEmail: 'worker@example.com',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    ...overrides,
  };
}

function makeAnalysisResult(overrides: Record<string, any> = {}) {
  return {
    isLikelyNonNative: false,
    nonNativeConfidence: 5,
    nonNativeIndicators: [],
    isLikelyAIGenerated: false,
    aiGeneratedConfidence: 10,
    aiGeneratedIndicators: [],
    isLikelyTemplated: false,
    templateConfidence: 3,
    templateIndicators: [],
    detectedTemplate: null,
    overallAssessment: 'Authentic.',
    recommendations: [],
    llmModel: 'gpt-4o',
    llmProvider: 'openai',
    llmCost: 0.001,
    ...overrides,
  };
}

function makeRequest(body: Record<string, any>) {
  return new NextRequest('http://localhost/api/prompt-authenticity/user-deep-dive/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/prompt-authenticity/user-deep-dive/analyze', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient() as any);

    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([makeDataRecord()] as any);
    vi.mocked(prisma.promptAuthenticityRecord.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([
      { id: 'par-1', versionId: 'rec-1', prompt: 'Write a story about a robot.' },
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.update).mockResolvedValue({} as any);

    const { analyzePromptAuthenticity } = await import('@repo/core');
    vi.mocked(analyzePromptAuthenticity).mockResolvedValue(makeAnalysisResult() as any);
  });

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn(() => ({ data: { user: null }, error: new Error('no session') })) },
    } as any);

    const res = await POST(makeRequest({ email: 'w@example.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for insufficient role', async () => {
    const { createClient } = await import('@repo/auth/server');
    vi.mocked(createClient).mockReturnValue(makeAuthClient('CORE') as any);

    const res = await POST(makeRequest({ email: 'w@example.com' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/i);
  });

  it('returns 403 for @fleet.so email', async () => {
    const res = await POST(makeRequest({ email: 'ops@fleet.so' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when user has no tasks', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([] as any);

    const res = await POST(makeRequest({ email: 'nobody@example.com' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no tasks/i);
  });

  it('returns 400 with "already analyzed" message when nothing is pending', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.analyzed).toBe(0);
    expect(data.message).toMatch(/already analyzed/i);
  });

  it('syncs new records and returns analyzed count', async () => {
    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.analyzed).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.synced).toBe(1);
  });

  it('deduplicates by task_key before syncing', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockResolvedValue([
      makeDataRecord({ id: 'old', metadata: { task_key: 'k1' }, createdAt: new Date('2026-01-01T08:00:00Z') }),
      makeDataRecord({ id: 'new', metadata: { task_key: 'k1' }, createdAt: new Date('2026-01-02T08:00:00Z') }),
    ] as any);
    vi.mocked(prisma.promptAuthenticityRecord.findMany).mockResolvedValue([] as any);

    await POST(makeRequest({ email: 'worker@example.com' }));

    const createMany = vi.mocked(prisma.promptAuthenticityRecord.createMany);
    const syncedIds = createMany.mock.calls[0][0].data.map((r: any) => r.versionId);
    expect(syncedIds).toHaveLength(1);
    expect(syncedIds[0]).toBe('new');
  });

  it('counts failed analyses correctly and logs errors', async () => {
    const { analyzePromptAuthenticity } = await import('@repo/core');
    vi.mocked(analyzePromptAuthenticity).mockRejectedValue(new Error('AI timeout'));

    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.failed).toBe(1);
    expect(data.analyzed).toBe(0);
    expect(data.message).toMatch(/failed/i);
  });

  it('filters by environment when provided', async () => {
    const { prisma } = await import('@repo/database');
    const findMany = vi.mocked(prisma.dataRecord.findMany);

    await POST(makeRequest({ email: 'worker@example.com', environment: 'staging' }));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ environment: 'staging' }) })
    );
  });

  it('returns 500 on unexpected database error', async () => {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.dataRecord.findMany).mockRejectedValue(new Error('DB gone'));

    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});
