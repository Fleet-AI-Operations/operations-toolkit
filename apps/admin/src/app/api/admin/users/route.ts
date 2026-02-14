
import { createClient, createAdminClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { NextResponse } from 'next/server'
import { logAudit, checkAuditResult } from '@repo/core/audit'
import { notifyUserCreated } from '@repo/core'

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the requesting user is an ADMIN
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = (adminProfile as any)?.role;
    // Allow ADMIN and MANAGER to view users list (needed for assignments)
    if (!['ADMIN', 'MANAGER'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const users = await prisma.profile.findMany({
            orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' },
                { email: 'asc' }
            ]
        })
        return NextResponse.json(users)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if ((adminProfile as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { userId, role, firstName, lastName } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
        }

        // Build update object dynamically
        const updateData: any = {}
        if (role !== undefined) updateData.role = role
        if (firstName !== undefined) updateData.firstName = firstName
        if (lastName !== undefined) updateData.lastName = lastName

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single()

        if (updateError) throw updateError

        // Log audit event (critical operation)
        const auditResult = await logAudit({
            action: role !== undefined ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
            entityType: 'USER',
            entityId: userId,
            userId: user.id,
            userEmail: user.email!,
            metadata: updateData
        })

        checkAuditResult(auditResult, role !== undefined ? 'USER_ROLE_CHANGED' : 'USER_UPDATED', {
            entityId: userId,
            userId: user.id
        })

        return NextResponse.json(updatedProfile)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    if (!adminUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUser.id)
        .single()

    if ((adminProfile as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { email, password, role, firstName, lastName } = await req.json()

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

        // 2. Update the profile created by the trigger to set role, names, and forced reset
        const updateData: any = {
            role,
            mustResetPassword: true
        }

        if (firstName) updateData.firstName = firstName
        if (lastName) updateData.lastName = lastName

        const { data: updatedProfile, error: updateError } = await adminClient
            .from('profiles')
            .update(updateData)
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
            userEmail: adminUser.email!,
            metadata: { email, role }
        })

        checkAuditResult(auditResult, 'USER_CREATED', {
            entityId: authData.user.id,
            userId: adminUser.id
        })

        // Send email notification to configured admins (non-blocking)
        notifyUserCreated({
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            role
        }).catch(error => {
            console.error('Failed to send user creation notification:', error);
            // Don't fail the request if notification fails
        });

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
