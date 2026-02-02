import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Count unassigned bug reports (assignedTo is null and status is not RESOLVED)
    const count = await prisma.bugReport.count({
      where: {
        assignedTo: null,
        status: {
          not: 'RESOLVED'
        }
      }
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting unassigned bug reports:', error)
    return NextResponse.json(
      { error: 'Failed to count unassigned bug reports' },
      { status: 500 }
    )
  }
}
