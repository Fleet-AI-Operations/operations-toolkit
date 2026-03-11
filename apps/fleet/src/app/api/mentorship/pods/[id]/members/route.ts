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
        .from('profiles').select('role').eq('id', user.id).single()

    if (profileError) return { error: NextResponse.json({ error: 'Failed to verify permissions.', errorId: ERROR_IDS.DB_QUERY_FAILED }, { status: 500 }) }
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return { error: NextResponse.json({ error: 'Forbidden', errorId: ERROR_IDS.AUTH_FORBIDDEN }, { status: 403 }) }
    }
    return { user }
}

/**
 * POST /api/mentorship/pods/[id]/members
 * Body: { members: Array<{ qaEmail: string; qaName?: string }> }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authorize(req)
    if (auth.error) return auth.error

    const { id: podId } = await params

    try {
        const { members } = await req.json()

        if (!Array.isArray(members) || members.length === 0) {
            return NextResponse.json({ error: 'members must be a non-empty array.', errorId: ERROR_IDS.INVALID_INPUT }, { status: 400 })
        }

        if (!members.every((m: any) => typeof m.qaEmail === 'string' && m.qaEmail.trim())) {
            return NextResponse.json({ error: 'Each member must have a valid qaEmail.', errorId: ERROR_IDS.INVALID_INPUT }, { status: 400 })
        }

        const pod = await prisma.mentorshipPod.findUnique({ where: { id: podId } })
        if (!pod) return NextResponse.json({ error: 'Pod not found.', errorId: ERROR_IDS.PROJECT_NOT_FOUND }, { status: 404 })

        const result = await prisma.mentorshipPodMember.createMany({
            data: members.map((m: { qaEmail: string; qaName?: string }) => ({
                podId,
                qaEmail: m.qaEmail.trim().toLowerCase(),
                qaName: m.qaName?.trim() ?? null
            })),
            skipDuplicates: true
        })

        return NextResponse.json({ added: result.count }, { status: 201 })
    } catch (error) {
        console.error('[Mentorship Members API] POST error:', error)
        return NextResponse.json({ error: 'Failed to add members.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
