'use server'

import { createClient, createAdminClient } from '@repo/auth/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/')
}

export async function updatePasswordAction(password: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        return { error: error.message }
    }

    // Clear the forced-reset flag now that the user has set their own password.
    // Uses the admin client because RLS only permits admins to UPDATE profiles.
    // Non-critical — password change already succeeded, so don't let this throw.
    // If the flag isn't cleared the user will be re-prompted to reset their password
    // on next login, even though this change succeeded.
    try {
        const adminClient = await createAdminClient()
        const { error: flagError } = await adminClient
            .from('profiles')
            .update({ mustResetPassword: false })
            .eq('id', data.user.id)
        if (flagError) {
            console.error('updatePasswordAction: failed to clear mustResetPassword flag', {
                userId: data.user.id,
                error: flagError.message,
                code: flagError.code,
            })
        }
    } catch (err) {
        console.error('updatePasswordAction: failed to clear mustResetPassword flag (threw)', err)
    }

    return { success: true }
}
