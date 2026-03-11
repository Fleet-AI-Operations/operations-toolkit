import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

const ROLE_WEIGHTS: Record<string, number> = {
    PENDING: 0, USER: 1, QA: 2, CORE: 3, FLEET: 4, MANAGER: 5, ADMIN: 6
}

/**
 * GET /api/mentorship/users
 * Returns users for populating pickers in the config UI.
 *
 * Query params:
 *   source=feedback_records — distinct users who have FEEDBACK records in data_records
 *                             (joined to profiles for id/name; falls back to email-only if no profile match)
 *   minRole / maxRole       — role-based filter from profiles (used for leader picker)
 */
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', errorId: ERROR_IDS.AUTH_UNAUTHORIZED }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError) return NextResponse.json({ error: 'Failed to verify permissions.', errorId: ERROR_IDS.DB_QUERY_FAILED }, { status: 500 })
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden', errorId: ERROR_IDS.AUTH_FORBIDDEN }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const source = searchParams.get('source')

        if (source === 'feedback_records') {
            // Distinct emails from FEEDBACK records
            const byEmail = await prisma.dataRecord.findMany({
                where: { type: 'FEEDBACK', createdByEmail: { not: null } },
                select: { createdByEmail: true, createdByName: true },
                distinct: ['createdByEmail']
            })

            // Combine and deduplicate by email (lowercased)
            const emailSet = new Set<string>()
            const nameByEmail = new Map<string, string | null>()

            for (const r of byEmail) {
                const key = r.createdByEmail!.toLowerCase()
                if (!emailSet.has(key)) {
                    emailSet.add(key)
                    nameByEmail.set(key, (r as any).createdByName ?? null)
                }
            }

            if (emailSet.size === 0) {
                return NextResponse.json({ users: [] })
            }

            const users = [...emailSet]
                .map(email => ({ email, name: nameByEmail.get(email) ?? null }))
                .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))

            return NextResponse.json({ users })
        }

        // Default: role-based filter
        const minRoleParam = searchParams.get('minRole') ?? 'QA'
        const maxRoleParam = searchParams.get('maxRole') ?? 'ADMIN'
        const minWeight = ROLE_WEIGHTS[minRoleParam] ?? 2
        const maxWeight = ROLE_WEIGHTS[maxRoleParam] ?? 6

        const eligibleRoles = Object.entries(ROLE_WEIGHTS)
            .filter(([, w]) => w >= minWeight && w <= maxWeight)
            .map(([role]) => role)

        const users = await prisma.profile.findMany({
            where: { role: { in: eligibleRoles as any[] } },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
            orderBy: [{ firstName: 'asc' }, { email: 'asc' }]
        })

        return NextResponse.json({ users })
    } catch (error) {
        console.error('[Mentorship Users API] GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch users.', errorId: ERROR_IDS.SYSTEM_ERROR }, { status: 500 })
    }
}
