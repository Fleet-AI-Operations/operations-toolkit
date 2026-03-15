import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { GET } from '../route';

vi.mock('@repo/api-utils', () => ({ requireRole: vi.fn() }));
vi.mock('@repo/database', () => ({
    prisma: { $queryRaw: vi.fn() },
}));

const FLEET_USER = { id: 'user-1', email: 'fleet@example.com', role: 'FLEET' };

const makeAuthSuccess = (user = FLEET_USER) => ({ user, error: null });
const makeAuthError = (status: number) => ({
    error: Response.json({ error: 'Unauthorized' }, { status }) as any,
});

const makeRequest = () =>
    new NextRequest('http://localhost:3004/api/admin/weekly-task-metrics/spotlight');

const SAMPLE_TASK_ROW = {
    id: 'task-1',
    environment: 'test-env',
    content: 'This is a task',
    createdByName: 'Alice',
    createdByEmail: 'alice@example.com',
    is_daily_great: true,
};

const SAMPLE_FEEDBACK_ROW = {
    id: 'feedback-1',
    environment: 'test-env',
    content: 'This is feedback',
    createdByName: 'Bob',
    createdByEmail: 'bob@example.com',
};

// Helper: set up $queryRaw to return rows for the happy path.
// vi.resetAllMocks() in beforeEach clears the once queue before each test,
// so each test that needs data must call this (or set its own mocks).
async function mockQueryRaw(
    tasks: unknown[] = [SAMPLE_TASK_ROW],
    feedback: unknown[] = [SAMPLE_FEEDBACK_ROW],
) {
    const { prisma } = await import('@repo/database');
    vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce(tasks as any)
        .mockResolvedValueOnce(feedback as any);
}

describe('GET /api/admin/weekly-task-metrics/spotlight', () => {
    beforeEach(async () => {
        // resetAllMocks clears mock implementations AND mockOnce queues,
        // preventing values queued by one test from leaking into the next.
        vi.resetAllMocks();
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthSuccess() as any);
    });

    // ── Auth ────────────────────────────────────────────────────────────────────

    it('returns 401 when unauthenticated', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(401) as any);

        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });

    it('returns 403 for insufficient role', async () => {
        const { requireRole } = await import('@repo/api-utils');
        vi.mocked(requireRole).mockResolvedValue(makeAuthError(403) as any);

        const res = await GET(makeRequest());
        expect(res.status).toBe(403);
    });

    // ── Happy path ──────────────────────────────────────────────────────────────

    it('returns 200 with tasks, feedback, and dateRange', async () => {
        await mockQueryRaw();

        const res = await GET(makeRequest());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.tasks).toHaveLength(1);
        expect(data.feedback).toHaveLength(1);
        expect(data.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(data.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns 200 with empty arrays when no records exist', async () => {
        await mockQueryRaw([], []);

        const res = await GET(makeRequest());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.tasks).toEqual([]);
        expect(data.feedback).toEqual([]);
        expect(data.dateRange.start).toBeDefined();
        expect(data.dateRange.end).toBeDefined();
    });

    // ── Field mapping ───────────────────────────────────────────────────────────

    it('maps is_daily_great: true to isDailyGreat on task records', async () => {
        await mockQueryRaw();

        const res = await GET(makeRequest());
        const data = await res.json();
        expect(data.tasks[0].isDailyGreat).toBe(true);
    });

    it('maps is_daily_great: false to isDailyGreat: false on task records', async () => {
        await mockQueryRaw([{ ...SAMPLE_TASK_ROW, is_daily_great: false }]);

        const res = await GET(makeRequest());
        const data = await res.json();
        expect(data.tasks[0].isDailyGreat).toBe(false);
    });

    it('does not include isDailyGreat on feedback records', async () => {
        await mockQueryRaw();

        const res = await GET(makeRequest());
        const data = await res.json();
        expect(Object.keys(data.feedback[0])).not.toContain('isDailyGreat');
        expect(Object.keys(data.feedback[0])).not.toContain('is_daily_great');
    });

    // ── SQL filters ─────────────────────────────────────────────────────────────

    it('excludes "Task approved by QA reviewer" from feedback SQL', async () => {
        await mockQueryRaw();
        await GET(makeRequest());
        const { prisma } = await import('@repo/database');
        const [, feedbackCall] = vi.mocked(prisma.$queryRaw).mock.calls;
        const sql = (feedbackCall[0] as TemplateStringsArray).join('?');
        expect(sql).toContain('Task approved by QA reviewer');
    });

    it('excludes @fleet.so addresses from task SQL', async () => {
        await mockQueryRaw();
        await GET(makeRequest());
        const { prisma } = await import('@repo/database');
        const [taskCall] = vi.mocked(prisma.$queryRaw).mock.calls;
        const sql = (taskCall[0] as TemplateStringsArray).join('?');
        expect(sql).toContain('@fleet.so');
    });

    it('excludes @fleet.so addresses from feedback SQL', async () => {
        await mockQueryRaw();
        await GET(makeRequest());
        const { prisma } = await import('@repo/database');
        const [, feedbackCall] = vi.mocked(prisma.$queryRaw).mock.calls;
        const sql = (feedbackCall[0] as TemplateStringsArray).join('?');
        expect(sql).toContain('@fleet.so');
    });

    // ── Error handling ──────────────────────────────────────────────────────────

    it('returns 500 with DB_QUERY_FAILED on PrismaClientKnownRequestError', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('DB error', { code: 'P2010', clientVersion: '5.0.0' })
        );

        const res = await GET(makeRequest());
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.errorId).toBe('DB_QUERY_FAILED');
    });

    it('returns 500 with DB_QUERY_FAILED on PrismaClientUnknownRequestError', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValue(
            new Prisma.PrismaClientUnknownRequestError('Unknown error', { clientVersion: '5.0.0' })
        );

        const res = await GET(makeRequest());
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.errorId).toBe('DB_QUERY_FAILED');
    });

    it('returns 400 with INVALID_INPUT on PrismaClientValidationError', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValue(
            new Prisma.PrismaClientValidationError('Validation error', { clientVersion: '5.0.0' })
        );

        const res = await GET(makeRequest());
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.errorId).toBe('INVALID_INPUT');
    });

    it('returns 503 with DB_CONNECTION_FAILED on PrismaClientInitializationError', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValue(
            new Prisma.PrismaClientInitializationError('Connection failed', '5.0.0')
        );

        const res = await GET(makeRequest());
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.errorId).toBe('DB_CONNECTION_FAILED');
    });

    it('returns 500 with SYSTEM_ERROR on unexpected error', async () => {
        const { prisma } = await import('@repo/database');
        vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Unexpected failure'));

        const res = await GET(makeRequest());
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.errorId).toBe('SYSTEM_ERROR');
    });
});
