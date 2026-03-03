import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@repo/database'

// Linear state type → our bug report status.
// Unmapped types (backlog, unstarted, triage) return null — we leave the status unchanged.
const STATE_TYPE_MAP: Record<string, string> = {
  started: 'IN_PROGRESS',
  completed: 'RESOLVED',
  cancelled: 'RESOLVED',
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const secretSetting = await prisma.systemSetting.findUnique({
    where: { key: 'linear_webhook_secret' }
  })

  // Reject all requests if no signing secret is configured
  if (!secretSetting?.value) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 401 })
  }

  const signature = request.headers.get('linear-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const expected = createHmac('sha256', secretSetting.value)
    .update(rawBody)
    .digest('hex')

  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  const signaturesMatch =
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!signaturesMatch) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle issue update events
  if (payload.type !== 'Issue' || payload.action !== 'update') {
    return NextResponse.json({ ok: true })
  }

  const linearIssueId: string | undefined = payload.data?.id
  const stateType: string | undefined = payload.data?.state?.type

  if (!linearIssueId || !stateType) {
    return NextResponse.json({ ok: true })
  }

  // Only act on state types we explicitly map — ignore backlog/unstarted/triage
  const newStatus = STATE_TYPE_MAP[stateType]
  if (!newStatus) {
    return NextResponse.json({ ok: true })
  }

  const report = await prisma.bugReport.findFirst({
    where: { linearIssueId }
  })

  if (!report) {
    // Not our issue — return 200 so Linear doesn't retry
    return NextResponse.json({ ok: true })
  }

  if (report.status !== newStatus) {
    await prisma.bugReport.update({
      where: { id: report.id },
      data: { status: newStatus }
    })
  }

  return NextResponse.json({ ok: true })
}
