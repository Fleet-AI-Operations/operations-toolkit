import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { logAudit } from '@repo/core/audit'
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

/** GET /api/mentorship/pods */
export async function GET(req: NextRequest) {
    const auth = await authorize(req)
    if (auth.error) return auth.error

    try {
        const pods = await prisma.mentorshipPod.findMany({
            include: {
                coreLeader: { select: { id: true, email: true, firstName: true, lastName: true } },
                members: { orderBy: { joinedAt: 'asc' } }
            },
            orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json({ pods })
    } catch (error) {
        console.error('[Mentorship Pods API] GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch pods.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}

/** POST /api/mentorship/pods — body: { name, coreLeaderId } */
export async function POST(req: NextRequest) {
    const auth = await authorize(req)
    if (auth.error) return auth.error

    try {
        const { name, coreLeaderId } = await req.json()

        if (!name?.trim()) return NextResponse.json({ error: 'Pod name is required.', errorId: ERROR_IDS.INVALID_INPUT }, { status: 400 })
        if (!coreLeaderId) return NextResponse.json({ error: 'Core leader is required.', errorId: ERROR_IDS.INVALID_INPUT }, { status: 400 })

        const leader = await prisma.profile.findUnique({ where: { id: coreLeaderId }, select: { id: true } })
        if (!leader) return NextResponse.json({ error: 'Core leader not found.', errorId: ERROR_IDS.USER_NOT_FOUND }, { status: 404 })

        const pod = await prisma.mentorshipPod.create({
            data: { name: name.trim(), coreLeaderId },
            include: {
                coreLeader: { select: { id: true, email: true, firstName: true, lastName: true } },
                members: true
            }
        })
        logAudit({
            action: 'POD_CREATED',
            entityType: 'MENTORSHIP_POD',
            entityId: pod.id,
            userId: auth.user.id,
            userEmail: auth.user.email ?? 'unknown',
            metadata: { name: pod.name, coreLeaderId },
        }).catch(err => console.error('[Mentorship Pods API] Audit log failed:', err));

        return NextResponse.json({ pod }, { status: 201 })
    } catch (error) {
        console.error('[Mentorship Pods API] POST error:', error)
        return NextResponse.json({ error: 'Failed to create pod.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
