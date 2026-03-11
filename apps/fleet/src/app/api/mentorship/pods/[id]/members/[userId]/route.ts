import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/mentorship/pods/[id]/members/[userId]
 * [userId] is actually the MentorshipPodMember row ID (cuid).
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', errorId: ERROR_IDS.AUTH_UNAUTHORIZED }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

    if (profileError) return NextResponse.json({ error: 'Failed to verify permissions.', errorId: ERROR_IDS.DB_QUERY_FAILED }, { status: 500 })
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden', errorId: ERROR_IDS.AUTH_FORBIDDEN }, { status: 403 })
    }

    const { id: podId, userId: memberId } = await params

    try {
        const membership = await prisma.mentorshipPodMember.findFirst({
            where: { id: memberId, podId }
        })
        if (!membership) return NextResponse.json({ error: 'Member not found in this pod.', errorId: ERROR_IDS.USER_NOT_FOUND }, { status: 404 })

        await prisma.mentorshipPodMember.delete({ where: { id: memberId } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Mentorship Members API] DELETE error:', error)
        return NextResponse.json({ error: 'Failed to remove member.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
