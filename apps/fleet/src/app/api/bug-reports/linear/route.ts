import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@repo/auth/server'
import { prisma } from '@repo/database'

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

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    // Fetch the bug report
    const report = await prisma.bugReport.findUnique({ where: { id } })
    if (!report) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    if (report.linearIssueId) {
      return NextResponse.json({ error: 'This bug report already has a linked Linear issue.', linearIssueUrl: report.linearIssueUrl }, { status: 409 })
    }

    // Read Linear credentials from SystemSetting
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['linear_api_key', 'linear_team_id'] } }
    })
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>)

    const linearApiKey = settingsMap['linear_api_key']
    const linearTeamId = settingsMap['linear_team_id']

    if (!linearApiKey || !linearTeamId) {
      return NextResponse.json(
        { error: 'Linear is not configured. Add your API key and team ID in Admin → AI Configuration.' },
        { status: 400 }
      )
    }

    const title = `Bug Report #${report.reportNumber}: ${report.description.slice(0, 80)}${report.description.length > 80 ? '...' : ''}`
    const description = [
      `**Reporter:** ${report.userEmail}`,
      `**Page:** ${report.pageUrl}`,
      `**Status:** ${report.status}`,
      '',
      '## Description',
      '',
      report.description,
    ].join('\n')

    // Call Linear GraphQL API
    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            url
          }
        }
      }
    `

    const linearResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': linearApiKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            teamId: linearTeamId,
            title,
            description,
          }
        }
      })
    })

    if (!linearResponse.ok) {
      const text = await linearResponse.text()
      console.error('Linear API error:', text)
      return NextResponse.json({ error: 'Failed to create Linear issue' }, { status: 502 })
    }

    const linearData = await linearResponse.json()

    if (linearData.errors) {
      console.error('Linear GraphQL errors:', linearData.errors)
      return NextResponse.json(
        { error: linearData.errors[0]?.message || 'Failed to create Linear issue' },
        { status: 502 }
      )
    }

    const issue = linearData.data?.issueCreate?.issue
    if (!issue) {
      return NextResponse.json({ error: 'Failed to create Linear issue' }, { status: 502 })
    }

    // Update bug report with Linear issue info
    await prisma.bugReport.update({
      where: { id },
      data: {
        linearIssueId: issue.id,
        linearIssueUrl: issue.url,
      }
    })

    return NextResponse.json({ success: true, linearIssueUrl: issue.url })
  } catch (error) {
    console.error('Error creating Linear issue:', error)
    return NextResponse.json({ error: 'Failed to create Linear issue' }, { status: 500 })
  }
}
