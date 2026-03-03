import { prisma } from '@repo/database'

const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'

const ISSUE_CREATE_MUTATION = `
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

export class LinearNotConfiguredError extends Error {
  constructor() {
    super('Linear is not configured. Add your API key and team ID in Admin → Configuration.')
    this.name = 'LinearNotConfiguredError'
  }
}

export class LinearAlreadyLinkedError extends Error {
  linearIssueUrl: string
  constructor(url: string) {
    super('This bug report already has a linked Linear issue.')
    this.name = 'LinearAlreadyLinkedError'
    this.linearIssueUrl = url
  }
}

export async function pushBugReportToLinear(bugReportId: string): Promise<{ linearIssueUrl: string }> {
  const report = await prisma.bugReport.findUnique({ where: { id: bugReportId } })
  if (!report) throw new Error('Bug report not found')

  if (report.linearIssueId) {
    throw new LinearAlreadyLinkedError(report.linearIssueUrl!)
  }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['linear_api_key', 'linear_team_id'] } }
  })
  const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>)

  const linearApiKey = settingsMap['linear_api_key']
  const linearTeamId = settingsMap['linear_team_id']

  if (!linearApiKey || !linearTeamId) {
    throw new LinearNotConfiguredError()
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

  const linearResponse = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': linearApiKey,
    },
    body: JSON.stringify({
      query: ISSUE_CREATE_MUTATION,
      variables: { input: { teamId: linearTeamId, title, description } }
    })
  })

  if (!linearResponse.ok) {
    const text = await linearResponse.text()
    console.error('Linear API error:', text)
    throw new Error('Failed to create Linear issue')
  }

  const linearData = await linearResponse.json() as any

  if (linearData.errors) {
    console.error('Linear GraphQL errors:', linearData.errors)
    throw new Error(linearData.errors[0]?.message || 'Failed to create Linear issue')
  }

  const issue = linearData.data?.issueCreate?.issue
  if (!issue) throw new Error('Failed to create Linear issue')

  await prisma.bugReport.update({
    where: { id: bugReportId },
    data: { linearIssueId: issue.id, linearIssueUrl: issue.url }
  })

  return { linearIssueUrl: issue.url }
}
