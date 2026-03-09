import { NextResponse } from 'next/server'
import { prisma } from '@repo/database'
import { requireAdminRole } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireAdminRole()
  if ('error' in authResult) return authResult.error

  try {
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
