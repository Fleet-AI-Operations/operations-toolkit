import { prisma } from '@repo/database'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@repo/api-utils'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

interface SpotlightRecord {
    id: string;
    environment: string;
    content: string;
    createdByName: string | null;
    createdByEmail: string | null;
    isDailyGreat?: boolean;
}

interface SpotlightResponse {
    tasks: SpotlightRecord[];
    feedback: SpotlightRecord[];
    dateRange: { start: string; end: string };
}

// GET 5 random TOP_10 tasks and 5 random TOP_10 feedback records from the previous 7 days.
// Each list enforces at most 1 record per user (by createdByEmail).
export async function GET(req: NextRequest) {
    const authResult = await requireRole(req, ['FLEET', 'MANAGER', 'ADMIN'])
    if (authResult.error) return authResult.error

    try {
        const endDate = new Date()
        endDate.setDate(endDate.getDate() - 1)
        endDate.setHours(23, 59, 59, 999)

        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 6)
        startDate.setHours(0, 0, 0, 0)

        // For each list: pick one random record per user from the TOP_10 pool,
        // then shuffle those de-duplicated rows and take 5.
        const [taskRows, feedbackRows] = await Promise.all([
            prisma.$queryRaw<{ id: string; environment: string; content: string; createdByName: string | null; createdByEmail: string | null; is_daily_great: boolean }[]>`
                SELECT id, environment, content, "createdByName", "createdByEmail", is_daily_great
                FROM (
                    SELECT DISTINCT ON ("createdByEmail")
                        id, environment, content, "createdByName", "createdByEmail", is_daily_great
                    FROM public.data_records
                    WHERE type = 'TASK'
                        AND category = 'TOP_10'
                        AND "createdAt" >= ${startDate}
                        AND "createdAt" <= ${endDate}
                        AND ("createdByEmail" IS NULL OR "createdByEmail" NOT ILIKE '%@fleet.so')
                    ORDER BY "createdByEmail", RANDOM()
                ) deduped
                ORDER BY RANDOM()
                LIMIT 5
            `,
            prisma.$queryRaw<{ id: string; environment: string; content: string; createdByName: string | null; createdByEmail: string | null }[]>`
                SELECT id, environment, content, "createdByName", "createdByEmail"
                FROM (
                    SELECT DISTINCT ON ("createdByEmail")
                        id, environment, content, "createdByName", "createdByEmail"
                    FROM public.data_records
                    WHERE type = 'FEEDBACK'
                        AND category = 'TOP_10'
                        AND "createdAt" >= ${startDate}
                        AND "createdAt" <= ${endDate}
                        AND ("createdByEmail" IS NULL OR "createdByEmail" NOT ILIKE '%@fleet.so')
                        AND TRIM(content) != 'Task approved by QA reviewer'
                    ORDER BY "createdByEmail", RANDOM()
                ) deduped
                ORDER BY RANDOM()
                LIMIT 5
            `,
        ])

        const response: SpotlightResponse = {
            tasks: taskRows.map(r => ({ ...r, isDailyGreat: r.is_daily_great })),
            feedback: feedbackRows,
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0],
            },
        }

        return NextResponse.json(response)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('[Spotlight API] Known database error:', {
                errorId: ERROR_IDS.DB_QUERY_FAILED,
                code: error.code,
                meta: error.meta,
                message: error.message,
                userId: authResult.user.id,
            })
            return NextResponse.json({ error: 'Database query failed. Please try again.', errorId: ERROR_IDS.DB_QUERY_FAILED }, { status: 500 })
        }

        if (error instanceof Prisma.PrismaClientInitializationError) {
            console.error('[Spotlight API] Database connection failed:', {
                errorId: ERROR_IDS.DB_CONNECTION_FAILED,
                message: error.message,
                userId: authResult.user.id,
            })
            return NextResponse.json({ error: 'Database connection failed. Please try again later.', errorId: ERROR_IDS.DB_CONNECTION_FAILED }, { status: 503 })
        }

        console.error('[Spotlight API] Unexpected error:', {
            errorId: ERROR_IDS.SYSTEM_ERROR,
            userId: authResult.user.id,
            error: error instanceof Error ? error.message : String(error),
        })
        return NextResponse.json({ error: 'An unexpected error occurred. Please try again.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
