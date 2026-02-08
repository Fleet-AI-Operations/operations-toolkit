import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ERROR_IDS } from '@/constants/errorIds'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

interface DailyActivity {
    date: string;
    taskCount: number;
    feedbackCount: number;
    totalCount: number;
}

// GET activity data for a configurable date range (defaults to past 30 days)
export async function GET(req: Request) {
    // Require FLEET role or higher (FLEET, ADMIN)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) {
        console.warn('[Activity Over Time API] Unauthorized/Forbidden access attempt:', {
            errorId: ERROR_IDS.AUTH_UNAUTHORIZED,
            timestamp: new Date().toISOString()
        })
        return authResult.error;
    }
    const { user } = authResult;

    try {
        // Parse query parameters for custom date range
        const { searchParams } = new URL(req.url)
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')

        let startDate: Date
        let endDate: Date

        if (startParam && endParam) {
            // Use custom date range
            startDate = new Date(startParam)
            endDate = new Date(endParam)

            // Validate dates
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

            // Set to start and end of day
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 59, 999)
        } else {
            // Default to past 30 days
            endDate = new Date()
            endDate.setHours(23, 59, 59, 999)

            startDate = new Date()
            startDate.setDate(startDate.getDate() - 29) // 29 days ago + today = 30 days
            startDate.setHours(0, 0, 0, 0)
        }

        // Fetch all records in the date range
        const records = await prisma.dataRecord.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                type: true,
                createdAt: true
            }
        })

        // Create a map to hold daily counts
        const dailyActivityMap = new Map<string, { taskCount: number; feedbackCount: number }>()

        // Calculate the number of days in the range
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

        // Initialize all days in the range with zero counts
        for (let i = 0; i < daysDiff; i++) {
            const date = new Date(startDate)
            date.setDate(date.getDate() + i)
            const dateKey = date.toISOString().split('T')[0]
            dailyActivityMap.set(dateKey, { taskCount: 0, feedbackCount: 0 })
        }

        // Count records by day
        records.forEach((record, index) => {
            try {
                if (!record.createdAt || !(record.createdAt instanceof Date)) {
                    console.error('[Activity Over Time API] Invalid createdAt date:', {
                        errorId: ERROR_IDS.INVALID_DATE_FORMAT,
                        recordType: record.type,
                        createdAt: record.createdAt,
                        recordIndex: index,
                        userId: user.id
                    })
                    return // Skip this record
                }

                const dateKey = record.createdAt.toISOString().split('T')[0]
                const counts = dailyActivityMap.get(dateKey)

                if (counts) {
                    if (record.type === 'TASK') {
                        counts.taskCount++
                    } else if (record.type === 'FEEDBACK') {
                        counts.feedbackCount++
                    }
                } else {
                    // Record falls outside requested range - data integrity issue
                    console.warn('[Activity Over Time API] Record outside date range:', {
                        errorId: ERROR_IDS.INVALID_DATE_RANGE,
                        dateKey,
                        requestedRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
                        recordType: record.type,
                        recordIndex: index
                    })
                }
            } catch (error) {
                console.error('[Activity Over Time API] Error processing record:', {
                    errorId: ERROR_IDS.SYSTEM_ERROR,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    recordType: record.type,
                    recordIndex: index,
                    userId: user.id
                })
                // Continue processing other records
            }
        })

        // Convert map to sorted array
        const dailyActivity: DailyActivity[] = Array.from(dailyActivityMap.entries())
            .map(([date, counts]) => ({
                date,
                taskCount: counts.taskCount,
                feedbackCount: counts.feedbackCount,
                totalCount: counts.taskCount + counts.feedbackCount
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json({
            dailyActivity,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        })
    } catch (error) {
        // Handle specific error types
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('[Activity Over Time API] Database error:', {
                errorId: ERROR_IDS.DB_QUERY_FAILED,
                code: error.code,
                meta: error.meta,
                message: error.message,
                userId: user?.id
            })
            return NextResponse.json({
                error: 'Database query failed. Please try again or contact support if the issue persists.',
                errorId: ERROR_IDS.DB_QUERY_FAILED
            }, { status: 500 })
        }

        if (error instanceof RangeError) {
            console.error('[Activity Over Time API] Date range calculation error:', {
                errorId: ERROR_IDS.INVALID_DATE_RANGE,
                error: error.message,
                userId: user?.id
            })
            return NextResponse.json({
                error: 'Invalid date range calculation. Please verify your dates and try again.',
                errorId: ERROR_IDS.INVALID_DATE_RANGE
            }, { status: 400 })
        }

        // Unexpected errors
        console.error('[Activity Over Time API] Unexpected error:', {
            errorId: ERROR_IDS.SYSTEM_ERROR,
            userId: user?.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        return NextResponse.json({
            error: 'An unexpected error occurred. Please try again.',
            errorId: ERROR_IDS.SYSTEM_ERROR
        }, { status: 500 })
    }
}
