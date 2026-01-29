import { createClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log(`[Reset Password API] DEEP DIAGNOSTIC - User ID: ${user.id}, Email: ${user.email}`)
        
        // 1. Try standard Prisma update first
        const updateResult = await prisma.profile.updateMany({
            where: {
                OR: [
                    { id: user.id },
                    { email: user.email }
                ]
            },
            data: { mustResetPassword: false }
        })

        console.log(`[Reset Password API] Prisma updateMany count: ${updateResult.count}`)

        // 2. If ORM didn't catch it, try RAW SQL (Force case-sensitive identifier)
        let rawCount = 0
        if (updateResult.count === 0) {
            console.log(`[Reset Password API] Prisma failed to find record. Trying RAW SQL...`)
            rawCount = await prisma.$executeRawUnsafe(
                `UPDATE public.profiles SET "mustResetPassword" = false WHERE id = $1::uuid OR email = $2`,
                user.id,
                user.email
            )
            console.log(`[Reset Password API] Raw SQL affected rows: ${rawCount}`)
        }

        // 3. Final verification - fetch the actual state
        const finalProfile = await prisma.profile.findFirst({
            where: {
                OR: [
                    { id: user.id },
                    { email: user.email }
                ]
            }
        })

        return NextResponse.json({ 
            success: true, 
            updated: updateResult.count || rawCount,
            found: !!finalProfile,
            currentState: finalProfile?.mustResetPassword,
            diagnostics: {
                id: user.id,
                email: user.email,
                prismaCount: updateResult.count,
                rawCount: rawCount
            }
        })
    } catch (error: any) {
        console.error('[Reset Password API] Fatal Error:', error)
        return NextResponse.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 })
    }
}
