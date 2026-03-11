import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: NextResponse.json({ error: 'Unauthorized', errorId: ERROR_IDS.AUTH_UNAUTHORIZED }, { status: 401 }) }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError) return { error: NextResponse.json({ error: 'Failed to verify permissions.', errorId: ERROR_IDS.DB_QUERY_FAILED }, { status: 500 }) }
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden', errorId: ERROR_IDS.AUTH_FORBIDDEN }, { status: 403 }) }
    }

    return { user }
}

/**
 * PATCH /api/mentorship/pods/[id]
 * Update a pod's name and/or core leader.
 * Body: { name?: string, coreLeaderId?: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authorize(req)
    if (auth.error) return auth.error

    const { id } = await params

    try {
        const body = await req.json()
        const { name, coreLeaderId } = body

        const existing = await prisma.mentorshipPod.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: 'Pod not found.', errorId: ERROR_IDS.PROJECT_NOT_FOUND }, { status: 404 })
        }

        if (coreLeaderId) {
            const leader = await prisma.profile.findUnique({ where: { id: coreLeaderId }, select: { id: true } })
            if (!leader) {
                return NextResponse.json({ error: 'Core leader not found.', errorId: ERROR_IDS.USER_NOT_FOUND }, { status: 404 })
            }
        }

        const pod = await prisma.mentorshipPod.update({
            where: { id },
            data: {
                ...(name?.trim() ? { name: name.trim() } : {}),
                ...(coreLeaderId ? { coreLeaderId } : {})
            },
            include: {
                coreLeader: { select: { id: true, email: true, firstName: true, lastName: true } },
                members: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } }
            }
        })

        return NextResponse.json({ pod })
    } catch (error) {
        console.error('[Mentorship Pod API] PATCH error:', error)
        return NextResponse.json({ error: 'Failed to update pod.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}

/**
 * DELETE /api/mentorship/pods/[id]
 * Delete a pod (cascades to members).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authorize(req)
    if (auth.error) return auth.error

    const { id } = await params

    try {
        const existing = await prisma.mentorshipPod.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: 'Pod not found.', errorId: ERROR_IDS.PROJECT_NOT_FOUND }, { status: 404 })
        }

        await prisma.mentorshipPod.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mentorship Pod API] DELETE error:', error)
        return NextResponse.json({ error: 'Failed to delete pod.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
