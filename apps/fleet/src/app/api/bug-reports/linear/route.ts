import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { pushBugReportToLinear, LinearNotConfiguredError, LinearAlreadyLinkedError } from '@repo/core/linear'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    const { linearIssueUrl } = await pushBugReportToLinear(id)
    return NextResponse.json({ success: true, linearIssueUrl })
  } catch (error) {
    if (error instanceof LinearAlreadyLinkedError) {
      return NextResponse.json({ error: error.message, linearIssueUrl: error.linearIssueUrl }, { status: 409 })
    }
    if (error instanceof LinearNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Bug report not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Error creating Linear issue:', error)
    return NextResponse.json({ error: 'Failed to create Linear issue' }, { status: 500 })
  }
}
