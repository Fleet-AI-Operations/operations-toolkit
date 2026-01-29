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
    const adminProfile = await prisma.profile.findUnique({
        where: { id: user.id }
    })

    if (adminProfile?.role !== 'ADMIN') {
        throw new Error('Forbidden: Only admins can delegate roles')
    }

    await prisma.profile.update({
        where: { id: userId },
        data: { role }
    })

    revalidatePath('/admin/users')
}
