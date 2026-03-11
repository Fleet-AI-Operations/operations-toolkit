import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { NextResponse } from 'next/server'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

const RATING_WINDOW_DAYS = 7

export async function GET(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.warn('[Mentorship Dashboard API] Unauthorized access attempt:', {
            errorId: ERROR_IDS.AUTH_UNAUTHORIZED,
            timestamp: new Date().toISOString()
        })
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
        console.error('[Mentorship Dashboard API] Profile query error:', {
            errorId: ERROR_IDS.DB_QUERY_FAILED,
            userId: user.id,
            error: profileError.message
        })
        return NextResponse.json({
            error: 'Failed to verify permissions.',
            errorId: ERROR_IDS.DB_QUERY_FAILED
        }, { status: 500 })
    }

    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        console.warn('[Mentorship Dashboard API] Forbidden access attempt:', {
            errorId: ERROR_IDS.AUTH_FORBIDDEN,
            userId: user.id,
            userRole: profile?.role || 'NONE'
        })
        return NextResponse.json({
            error: 'Forbidden',
            errorId: ERROR_IDS.AUTH_FORBIDDEN
        }, { status: 403 })
    }

    try {
        // Fetch all pods with their core leader and members
        const pods = await prisma.mentorshipPod.findMany({
            include: {
                coreLeader: {
                    select: { id: true, email: true, firstName: true, lastName: true }
                },
                members: { orderBy: { joinedAt: 'asc' } }
            },
            orderBy: { createdAt: 'asc' }
        })

        // Collect all member emails for a single bulk ratings query
        const allMemberEmails = pods.flatMap(pod => pod.members.map(m => m.qaEmail))

        // Fetch QA feedback ratings for the past N days for all members in one query
        const windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - RATING_WINDOW_DAYS)
        windowStart.setHours(0, 0, 0, 0)

        const ratings = allMemberEmails.length > 0
            ? await prisma.qAFeedbackRating.findMany({
                where: {
                    qaEmail: { in: allMemberEmails },
                    ratedAt: { gte: windowStart }
                },
                select: { qaEmail: true, isHelpful: true }
            })
            : []

        // Build a map of email -> { total, positive }
        const ratingsByEmail = new Map<string, { total: number; positive: number }>()
        for (const rating of ratings) {
            const existing = ratingsByEmail.get(rating.qaEmail) ?? { total: 0, positive: 0 }
            existing.total++
            if (rating.isHelpful) existing.positive++
            ratingsByEmail.set(rating.qaEmail, existing)
        }

        // Shape the response
        const podData = pods.map(pod => {
            const members = pod.members.map(m => {
                const stats = ratingsByEmail.get(m.qaEmail) ?? { total: 0, positive: 0 }
                return {
                    id: m.id,
                    email: m.qaEmail,
                    name: m.qaName,
                    totalRatings: stats.total,
                    positiveRatings: stats.positive,
                    positiveFeedbackRate: stats.total > 0
                        ? Math.round((stats.positive / stats.total) * 100)
                        : null
                }
            })

            const podTotal = members.reduce((s, m) => s + m.totalRatings, 0)
            const podPositive = members.reduce((s, m) => s + m.positiveRatings, 0)

            return {
                id: pod.id,
                name: pod.name,
                coreLeader: {
                    id: pod.coreLeader.id,
                    email: pod.coreLeader.email,
                    firstName: pod.coreLeader.firstName,
                    lastName: pod.coreLeader.lastName
                },
                members,
                podPositiveRate: podTotal > 0
                    ? Math.round((podPositive / podTotal) * 100)
                    : null
            }
        })

        return NextResponse.json({
            pods: podData,
            windowDays: RATING_WINDOW_DAYS,
            asOf: new Date().toISOString()
        })
    } catch (error) {
        console.error('[Mentorship Dashboard API] Unexpected error:', {
            errorId: ERROR_IDS.SYSTEM_ERROR,
            userId: user?.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        return NextResponse.json({
            error: 'An unexpected error occurred.',
            errorId: ERROR_IDS.SYSTEM_ERROR
        }, { status: 500 })
    }
}
