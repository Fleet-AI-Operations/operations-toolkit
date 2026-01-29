'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'

export async function updateUserRole(userId: string, role: UserRole) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // Check if the current user is an admin
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if ((adminProfile as any)?.role !== 'ADMIN') {
        throw new Error('Forbidden: Only admins can delegate roles')
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)

    if (updateError) throw updateError

    revalidatePath('/admin/users')
}
