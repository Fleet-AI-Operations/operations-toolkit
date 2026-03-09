import { NextRequest, NextResponse } from 'next/server'
import { pushBugReportToLinear, LinearNotConfiguredError, LinearAlreadyLinkedError } from '@repo/core/linear'
import { requireAdminRole } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  const authResult = await requireAdminRole()
  if ('error' in authResult) return authResult.error

  try {
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
