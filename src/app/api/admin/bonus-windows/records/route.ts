import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET records for a specific bonus window
export async function GET(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is MANAGER or ADMIN
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['MANAGER', 'ADMIN'].includes((profile as any)?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const windowId = searchParams.get('windowId')

        if (!windowId) {
            return NextResponse.json({ error: 'Missing windowId parameter' }, { status: 400 })
        }

        // Get the bonus window
        const window = await prisma.bonusWindow.findUnique({
            where: { id: windowId }
        })

        if (!window) {
            return NextResponse.json({ error: 'Bonus window not found' }, { status: 404 })
        }

        // Get aggregated record counts by user email with task/feedback breakdown
        // Only show users who met or exceeded BOTH tier 1 targets (if set)
        const recordsByUser = await prisma.$queryRaw<Array<{
            email: string;
            task_count: bigint;
            feedback_count: bigint;
            total_count: bigint;
        }>>`
            SELECT
                COALESCE("createdByEmail", 'Unknown') as email,
                COUNT(*) FILTER (WHERE type = 'TASK')::bigint as task_count,
                COUNT(*) FILTER (WHERE type = 'FEEDBACK')::bigint as feedback_count,
                COUNT(*)::bigint as total_count
            FROM data_records
            WHERE "createdAt" >= ${window.startTime}
            AND "createdAt" <= ${window.endTime}
            GROUP BY "createdByEmail"
            HAVING
                (${window.targetTaskCount} = 0 OR COUNT(*) FILTER (WHERE type = 'TASK') >= ${window.targetTaskCount})
                AND (${window.targetFeedbackCount} = 0 OR COUNT(*) FILTER (WHERE type = 'FEEDBACK') >= ${window.targetFeedbackCount})
            ORDER BY total_count DESC
        `

        // Convert bigint to number and determine tier for each category
        const formattedResults = recordsByUser.map(row => {
            const taskCount = Number(row.task_count)
            const feedbackCount = Number(row.feedback_count)

            // Determine task tier
            let taskTier: number | null = null
            if (window.targetTaskCount > 0) {
                if (window.targetTaskCountTier2 > 0 && taskCount >= window.targetTaskCountTier2) {
                    taskTier = 2
                } else if (taskCount >= window.targetTaskCount) {
                    taskTier = 1
                }
            }

            // Determine feedback tier
            let feedbackTier: number | null = null
            if (window.targetFeedbackCount > 0) {
                if (window.targetFeedbackCountTier2 > 0 && feedbackCount >= window.targetFeedbackCountTier2) {
                    feedbackTier = 2
                } else if (feedbackCount >= window.targetFeedbackCount) {
                    feedbackTier = 1
                }
            }

            return {
                email: row.email,
                taskCount,
                feedbackCount,
                totalCount: Number(row.total_count),
                taskTier,
                feedbackTier
            }
        })

        return NextResponse.json(formattedResults)
    } catch (error: any) {
        console.error('[Bonus Windows Records API] GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
