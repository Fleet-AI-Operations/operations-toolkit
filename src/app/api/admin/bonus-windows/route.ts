import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET all bonus windows with calculated progress
export async function GET() {
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
        const windows = await prisma.bonusWindow.findMany({
            orderBy: { createdAt: 'desc' }
        })

        // Calculate actual counts for each window (all users)
        const windowsWithProgress = await Promise.all(
            windows.map(async (window) => {
                const taskCount = await prisma.dataRecord.count({
                    where: {
                        type: 'TASK',
                        createdAt: {
                            gte: window.startTime,
                            lte: window.endTime
                        }
                    }
                })

                const feedbackCount = await prisma.dataRecord.count({
                    where: {
                        type: 'FEEDBACK',
                        createdAt: {
                            gte: window.startTime,
                            lte: window.endTime
                        }
                    }
                })

                const taskProgress = window.targetTaskCount > 0
                    ? Math.min(100, Math.round((taskCount / window.targetTaskCount) * 100))
                    : 100

                const feedbackProgress = window.targetFeedbackCount > 0
                    ? Math.min(100, Math.round((feedbackCount / window.targetFeedbackCount) * 100))
                    : 100

                const taskProgressTier2 = window.targetTaskCountTier2 > 0
                    ? Math.min(100, Math.round((taskCount / window.targetTaskCountTier2) * 100))
                    : 100

                const feedbackProgressTier2 = window.targetFeedbackCountTier2 > 0
                    ? Math.min(100, Math.round((feedbackCount / window.targetFeedbackCountTier2) * 100))
                    : 100

                return {
                    ...window,
                    actualTaskCount: taskCount,
                    actualFeedbackCount: feedbackCount,
                    taskProgress,
                    feedbackProgress,
                    taskProgressTier2,
                    feedbackProgressTier2
                }
            })
        )

        return NextResponse.json(windowsWithProgress)
    } catch (error: any) {
        console.error('[Bonus Windows API] GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Create new bonus window
export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['MANAGER', 'ADMIN'].includes((profile as any)?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { name, startTime, endTime, targetTaskCount, targetFeedbackCount, targetTaskCountTier2, targetFeedbackCountTier2 } = await req.json()

        if (!startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (new Date(endTime) <= new Date(startTime)) {
            return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
        }

        const taskTarget = targetTaskCount || 0
        const feedbackTarget = targetFeedbackCount || 0

        if (taskTarget <= 0 && feedbackTarget <= 0) {
            return NextResponse.json({ error: 'At least one tier 1 target must be positive' }, { status: 400 })
        }

        const newWindow = await prisma.bonusWindow.create({
            data: {
                name: name || 'Bonus Window',
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                targetTaskCount: taskTarget,
                targetFeedbackCount: feedbackTarget,
                targetTaskCountTier2: targetTaskCountTier2 || 0,
                targetFeedbackCountTier2: targetFeedbackCountTier2 || 0,
                createdBy: user.id
            }
        })

        return NextResponse.json(newWindow)
    } catch (error: any) {
        console.error('[Bonus Windows API] POST error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH - Update existing bonus window
export async function PATCH(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['MANAGER', 'ADMIN'].includes((profile as any)?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id, name, startTime, endTime, targetTaskCount, targetFeedbackCount, targetTaskCountTier2, targetFeedbackCountTier2 } = await req.json()

        if (!id) {
            return NextResponse.json({ error: 'Missing window ID' }, { status: 400 })
        }

        if (endTime && startTime && new Date(endTime) <= new Date(startTime)) {
            return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
        }

        const updateData: any = {}
        if (name) updateData.name = name
        if (startTime) updateData.startTime = new Date(startTime)
        if (endTime) updateData.endTime = new Date(endTime)
        if (targetTaskCount !== undefined) updateData.targetTaskCount = targetTaskCount
        if (targetFeedbackCount !== undefined) updateData.targetFeedbackCount = targetFeedbackCount
        if (targetTaskCountTier2 !== undefined) updateData.targetTaskCountTier2 = targetTaskCountTier2
        if (targetFeedbackCountTier2 !== undefined) updateData.targetFeedbackCountTier2 = targetFeedbackCountTier2

        const updatedWindow = await prisma.bonusWindow.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json(updatedWindow)
    } catch (error: any) {
        console.error('[Bonus Windows API] PATCH error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE - Remove bonus window
export async function DELETE(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing window ID' }, { status: 400 })
        }

        await prisma.bonusWindow.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[Bonus Windows API] DELETE error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
