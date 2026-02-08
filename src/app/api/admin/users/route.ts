import { createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { logAudit, checkAuditResult } from '@/lib/audit'
import { requireRole } from '@/lib/auth-helpers'

export async function GET() {
    // Allow FLEET and ADMIN to view users list (needed for assignments)
    const authResult = await requireRole('FLEET');
    if ('error' in authResult) return authResult.error;

    try {
        const users = await prisma.profile.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(users)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    // Only ADMIN can change user roles
    const authResult = await requireRole('ADMIN');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const { userId, role } = await req.json()

        if (!userId || !role) {
            return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 })
        }

        const updatedProfile = await prisma.profile.update({
            where: { id: userId },
            data: { role }
        })

        // Log audit event (critical operation)
        const auditResult = await logAudit({
            action: 'USER_ROLE_CHANGED',
            entityType: 'USER',
            entityId: userId,
            userId: user.id,
            userEmail: user.email,
            metadata: { newRole: role }
        })

        checkAuditResult(auditResult, 'USER_ROLE_CHANGED', {
            entityId: userId,
            userId: user.id
        })

        return NextResponse.json(updatedProfile)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    // Only ADMIN can create new users
    const authResult = await requireRole('ADMIN');
    if ('error' in authResult) return authResult.error;
    const { user: adminUser } = authResult;

    try {
        const { email, password, role } = await req.json()

        if (!email || !password || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const adminClient = await createAdminClient()

        // 1. Create user in Supabase Auth (bypassing confirmation)
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role }
        })

        if (authError) throw authError

        // 2. Update the profile created by the trigger to set role and forced reset
        const { data: updatedProfile, error: updateError } = await adminClient
            .from('profiles')
            .update({
                role,
                mustResetPassword: true
            })
            .eq('id', authData.user.id)
            .select()
            .single()

        if (updateError) throw updateError

        // Log audit event (critical operation)
        const auditResult = await logAudit({
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: authData.user.id,
            userId: adminUser.id,
            userEmail: adminUser.email,
            metadata: { email, role }
        })

        checkAuditResult(auditResult, 'USER_CREATED', {
            entityId: authData.user.id,
            userId: adminUser.id
        })

        return NextResponse.json(updatedProfile)
    } catch (error: any) {
        console.error('[Admin API] Create user error:', error)
        let message = error.message
        if (message.includes('already been registered')) {
            message = 'A user with this email already exists in Supabase Auth (auth.users), but is missing from the profiles table. Please delete them from the Supabase Auth dashboard before trying again.'
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
