import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

interface EnvironmentCount {
    environment: string;
    count: number;
}

interface WeeklyMetrics {
    uniqueTasksCreated: number;
    uniqueTasksCreatedByEnvironment: EnvironmentCount[];
    totalTasksApproved: number;
    totalTasksApprovedByEnvironment: EnvironmentCount[];
    totalRevisions: number;
    dateRange: { start: string; end: string };
}

// GET weekly task metrics for the previous 7 days (defaulting to the 7 days ending yesterday)
export async function GET(req: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
        console.error('[Weekly Task Metrics API] Auth error:', {
            errorId: ERROR_IDS.AUTH_SESSION_EXPIRED,
            error: authError.message,
        })
        return NextResponse.json({
            error: 'Authentication failed. Please try logging in again.',
            errorId: ERROR_IDS.AUTH_SESSION_EXPIRED
        }, { status: 401 })
    }

    if (!user) {
        return NextResponse.json({
            error: 'Unauthorized',
            errorId: ERROR_IDS.AUTH_UNAUTHORIZED
        }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError) {
        console.error('[Weekly Task Metrics API] Profile query error:', {
            errorId: ERROR_IDS.DB_QUERY_FAILED,
            userId: user.id,
            error: profileError.message,
            code: profileError.code,
            details: profileError.details,
        })
        return NextResponse.json({
            error: 'Failed to verify permissions. Please try again.',
            errorId: ERROR_IDS.DB_QUERY_FAILED
        }, { status: 500 })
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        console.warn('[Weekly Task Metrics API] Forbidden access attempt:', {
            errorId: ERROR_IDS.AUTH_FORBIDDEN,
            userId: user.id,
            userRole: profile?.role ?? 'NONE',
        })
        return NextResponse.json({
            error: 'Forbidden',
            errorId: ERROR_IDS.AUTH_FORBIDDEN
        }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')
        const environmentsParam = searchParams.get('environments')
        const selectedEnvironments = environmentsParam
            ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
            : []

        let startDate: Date
        let endDate: Date

        if (startParam && endParam) {
            startDate = new Date(startParam)
            endDate = new Date(endParam)

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return NextResponse.json({
                    error: 'Invalid date format',
                    errorId: ERROR_IDS.INVALID_DATE_FORMAT
                }, { status: 400 })
            }

            if (startDate > endDate) {
                return NextResponse.json({
                    error: 'Start date must be before end date',
                    errorId: ERROR_IDS.INVALID_DATE_RANGE
                }, { status: 400 })
            }

            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 59, 999)
        } else {
            // Default: 7 days ending yesterday
            endDate = new Date()
            endDate.setDate(endDate.getDate() - 1)
            endDate.setHours(23, 59, 59, 999)

            startDate = new Date(endDate)
            startDate.setDate(startDate.getDate() - 6) // 6 days back + endDate = 7 days
            startDate.setHours(0, 0, 0, 0)
        }

        const envFilter = selectedEnvironments.length > 0
            ? Prisma.sql`AND environment IN (${Prisma.join(selectedEnvironments)})`
            : Prisma.empty

        // All three queries run in parallel
        const [createdRows, approvedRows, revisionsRow] = await Promise.all([
            // Unique tasks created, grouped by environment
            prisma.$queryRaw<{ environment: string; count: bigint }[]>`
                SELECT environment, COUNT(*) AS count
                FROM public.data_records
                WHERE type = 'TASK'
                    AND "createdAt" >= ${startDate}
                    AND "createdAt" <= ${endDate}
                    AND ("createdByEmail" IS NULL OR "createdByEmail" NOT ILIKE '%@fleet.so')
                    ${envFilter}
                GROUP BY environment
                ORDER BY count DESC
            `,

            // Tasks approved: feedback records with approved status, grouped by environment
            prisma.$queryRaw<{ environment: string; count: bigint }[]>`
                SELECT environment, COUNT(*) AS count
                FROM public.data_records
                WHERE type = 'FEEDBACK'
                    AND "createdAt" >= ${startDate}
                    AND "createdAt" <= ${endDate}
                    AND ("createdByEmail" IS NULL OR "createdByEmail" NOT ILIKE '%@fleet.so')
                    AND LOWER(metadata->>'feedback_outcome') = 'approved'
                    ${envFilter}
                GROUP BY environment
                ORDER BY count DESC
            `,

            // Revisions: tasks with task_version > 1
            prisma.$queryRaw<{ count: bigint }[]>`
                SELECT COUNT(*) AS count
                FROM public.data_records
                WHERE type = 'TASK'
                    AND "createdAt" >= ${startDate}
                    AND "createdAt" <= ${endDate}
                    AND ("createdByEmail" IS NULL OR "createdByEmail" NOT ILIKE '%@fleet.so')
                    AND metadata->>'task_version' ~ '^[0-9]+$'
                    AND (metadata->>'task_version')::integer > 1
                    ${envFilter}
            `,
        ])

        const uniqueTasksCreatedByEnvironment: EnvironmentCount[] = createdRows.map(r => ({
            environment: r.environment,
            count: Number(r.count),
        }))

        const totalTasksApprovedByEnvironment: EnvironmentCount[] = approvedRows.map(r => ({
            environment: r.environment,
            count: Number(r.count),
        }))

        const metrics: WeeklyMetrics = {
            uniqueTasksCreated: uniqueTasksCreatedByEnvironment.reduce((sum, r) => sum + r.count, 0),
            uniqueTasksCreatedByEnvironment,
            totalTasksApproved: totalTasksApprovedByEnvironment.reduce((sum, r) => sum + r.count, 0),
            totalTasksApprovedByEnvironment,
            totalRevisions: (() => {
                if (!revisionsRow[0]) {
                    console.warn('[Weekly Task Metrics API] COUNT query returned no rows — unexpected empty result:', {
                        errorId: ERROR_IDS.DB_QUERY_FAILED,
                        userId: user?.id,
                        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
                    })
                }
                return Number(revisionsRow[0]?.count ?? 0)
            })(),
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0],
            },
        }

        return NextResponse.json(metrics)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('[Weekly Task Metrics API] Known database error:', {
                errorId: ERROR_IDS.DB_QUERY_FAILED,
                code: error.code,
                meta: error.meta,
                message: error.message,
                userId: user?.id,
            })
            return NextResponse.json({
                error: 'Database query failed. Please try again.',
                errorId: ERROR_IDS.DB_QUERY_FAILED
            }, { status: 500 })
        }

        if (error instanceof Prisma.PrismaClientUnknownRequestError) {
            console.error('[Weekly Task Metrics API] Unknown database engine error:', {
                errorId: ERROR_IDS.DB_QUERY_FAILED,
                message: error.message,
                userId: user?.id,
            })
            return NextResponse.json({
                error: 'Database query failed. Please try again.',
                errorId: ERROR_IDS.DB_QUERY_FAILED
            }, { status: 500 })
        }

        if (error instanceof Prisma.PrismaClientInitializationError) {
            console.error('[Weekly Task Metrics API] Database connection failed:', {
                errorId: ERROR_IDS.DB_CONNECTION_FAILED,
                message: error.message,
                errorCode: error.errorCode,
                userId: user?.id,
            })
            return NextResponse.json({
                error: 'Database connection failed. Please try again later.',
                errorId: ERROR_IDS.DB_CONNECTION_FAILED
            }, { status: 503 })
        }

        if (error instanceof Prisma.PrismaClientValidationError) {
            console.error('[Weekly Task Metrics API] Query validation error:', {
                errorId: ERROR_IDS.DB_QUERY_FAILED,
                message: error.message,
                userId: user?.id,
            })
            return NextResponse.json({
                error: 'An internal error occurred with the query.',
                errorId: ERROR_IDS.DB_QUERY_FAILED
            }, { status: 500 })
        }

        console.error('[Weekly Task Metrics API] Unexpected error:', {
            errorId: ERROR_IDS.SYSTEM_ERROR,
            userId: user?.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
        return NextResponse.json({
            error: 'An unexpected error occurred. Please try again.',
            errorId: ERROR_IDS.SYSTEM_ERROR
        }, { status: 500 })
    }
}
