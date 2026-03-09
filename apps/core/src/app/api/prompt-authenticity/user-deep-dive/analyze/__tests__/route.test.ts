import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// ── Auth mock helpers ──────────────────────────────────────────────────────

function makeAuthClient(role = 'CORE') {
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
  analyzeTemplateUsage: vi.fn(),
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

    const { analyzePromptAuthenticity, analyzeTemplateUsage } = await import('@repo/core');
    vi.mocked(analyzePromptAuthenticity).mockResolvedValue(makeAnalysisResult() as any);
    vi.mocked(analyzeTemplateUsage).mockResolvedValue({
      isLikelyTemplated: false,
      templateConfidence: 0,
      templateIndicators: [],
      detectedTemplate: null,
      matchingPromptIds: [],
      overallAssessment: '',
    } as any);
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
    vi.mocked(createClient).mockReturnValue(makeAuthClient('QA') as any);

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

  it('returns 200 with "already analyzed" message when nothing is pending', async () => {
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

  // ── Step 5: cross-prompt template analysis ─────────────────────────────

  it('skips template analysis when fewer than 2 completed records exist', async () => {
    const { analyzeTemplateUsage } = await import('@repo/core');
    // Default beforeEach returns 1 completed record from findMany — below the threshold

    await POST(makeRequest({ email: 'worker@example.com' }));

    expect(analyzeTemplateUsage).not.toHaveBeenCalled();
  });

  it('runs template analysis and writes results when 2+ completed records exist', async () => {
    const { prisma } = await import('@repo/database');
    const { analyzeTemplateUsage } = await import('@repo/core');

    vi.mocked(prisma.promptAuthenticityRecord.findMany)
      // Step 3: 1 pending record
      .mockResolvedValueOnce([{ id: 'par-1', versionId: 'rec-1', prompt: 'Write a story.' }] as any)
      // Step 5: 2 completed records
      .mockResolvedValueOnce([
        { id: 'par-1', prompt: 'Write a story.' },
        { id: 'par-2', prompt: 'Write a poem.' },
      ] as any);

    vi.mocked(analyzeTemplateUsage).mockResolvedValue({
      isLikelyTemplated: true,
      templateConfidence: 85,
      templateIndicators: ['Same opening structure'],
      detectedTemplate: 'Write a [type].',
      matchingPromptIds: ['par-1'],
      overallAssessment: 'Template detected.',
    } as any);

    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(200);

    expect(analyzeTemplateUsage).toHaveBeenCalledWith(
      expect.arrayContaining([
        { id: 'par-1', text: 'Write a story.' },
        { id: 'par-2', text: 'Write a poem.' },
      ]),
      { silent: true }
    );

    const updateCalls = vi.mocked(prisma.promptAuthenticityRecord.update).mock.calls;
    const templateUpdates = updateCalls.filter((c) => 'isLikelyTemplated' in (c[0].data ?? {}));
    expect(templateUpdates.some((c) => c[0].where.id === 'par-1' && c[0].data.isLikelyTemplated === true)).toBe(true);
    expect(templateUpdates.some((c) => c[0].where.id === 'par-2' && c[0].data.isLikelyTemplated === false)).toBe(true);
  });

  it('template analysis failure is non-fatal — still returns 200 with templateAnalysisFailed flag', async () => {
    const { prisma } = await import('@repo/database');
    const { analyzeTemplateUsage } = await import('@repo/core');

    vi.mocked(prisma.promptAuthenticityRecord.findMany)
      .mockResolvedValueOnce([{ id: 'par-1', versionId: 'rec-1', prompt: 'Write a story.' }] as any)
      .mockResolvedValueOnce([
        { id: 'par-1', prompt: 'Write a story.' },
        { id: 'par-2', prompt: 'Write a poem.' },
      ] as any);

    vi.mocked(analyzeTemplateUsage).mockRejectedValue(new Error('LLM timeout'));

    const res = await POST(makeRequest({ email: 'worker@example.com' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.analyzed).toBe(1);
    expect(data.templateAnalysisFailed).toBe(true);
  });

  it('applies environment filter to the completed-records query in step 5', async () => {
    const { prisma } = await import('@repo/database');

    vi.mocked(prisma.promptAuthenticityRecord.findMany)
      .mockResolvedValueOnce([{ id: 'par-1', versionId: 'rec-1', prompt: 'Write a story.' }] as any)
      .mockResolvedValueOnce([
        { id: 'par-1', prompt: 'Write a story.' },
        { id: 'par-2', prompt: 'Write a poem.' },
      ] as any);

    await POST(makeRequest({ email: 'worker@example.com', environment: 'staging' }));

    const findManyCalls = vi.mocked(prisma.promptAuthenticityRecord.findMany).mock.calls;
    expect(findManyCalls[1][0]).toMatchObject({
      where: expect.objectContaining({ envKey: 'staging' }),
    });
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
