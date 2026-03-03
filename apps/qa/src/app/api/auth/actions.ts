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
    const adminClient = await createAdminClient()
    await adminClient
        .from('profiles')
        .update({ mustResetPassword: false })
        .eq('id', data.user.id)

    return { success: true }
}
