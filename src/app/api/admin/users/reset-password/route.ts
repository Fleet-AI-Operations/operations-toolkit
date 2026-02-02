import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logAudit, checkAuditResult } from '@/lib/audit'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    if (!adminUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the requesting user is an ADMIN
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUser.id)
        .single()

    if ((adminProfile as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Only admins can reset passwords' }, { status: 403 })
    }

    try {
        const { userId, password } = await req.json()

        if (!userId || !password) {
            return NextResponse.json({ error: 'Missing userId or password' }, { status: 400 })
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
        }

        const adminClient = await createAdminClient()

        // 1. Update the user's password in Supabase Auth
        const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(
            userId,
            { password }
        )

        if (updatePasswordError) {
            throw updatePasswordError
        }

        // 2. Set mustResetPassword flag in the profiles table
        const { error: updateProfileError } = await adminClient
            .from('profiles')
            .update({ mustResetPassword: true })
            .eq('id', userId)

        if (updateProfileError) {
            throw updateProfileError
        }

        // Log audit event (critical operation)
        const auditResult = await logAudit({
            action: 'USER_PASSWORD_RESET',
            entityType: 'USER',
            entityId: userId,
            userId: adminUser.id,
            userEmail: adminUser.email!,
            metadata: { resetByAdmin: true }
        })

        checkAuditResult(auditResult, 'USER_PASSWORD_RESET', {
            entityId: userId,
            userId: adminUser.id
        })

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully. User will be required to change it on next login.'
        })
    } catch (error: any) {
        console.error('[Admin API] Reset password error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
