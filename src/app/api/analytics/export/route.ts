import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const LLM_SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * GET /api/analytics/export
 * Export Likert scores as CSV or JSON
 */
export async function GET(request: NextRequest) {
    const authResult = await requireRole(request, 'FLEET');
    if (authResult.error) return authResult.error;

    try {
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get('projectId');
        const format = searchParams.get('format') || 'csv';
        const includeContent = searchParams.get('includeContent') === 'true';

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Get project info
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get all scores with related data
        const scores = await prisma.likertScore.findMany({
            where: {
                record: { projectId }
            },
            include: {
                record: {
                    select: {
                        id: true,
                        content: includeContent,
                        category: true,
                        type: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Get user emails for human raters
        const humanUserIds = [...new Set(scores.filter(s => s.userId !== LLM_SYSTEM_UUID).map(s => s.userId))];
        const profiles = await prisma.profile.findMany({
            where: { id: { in: humanUserIds } },
            select: { id: true, email: true }
        });
        const userEmailMap = new Map(profiles.map(p => [p.id, p.email]));

        // Transform data
        const exportData = scores.map(s => ({
            recordId: s.recordId,
            ...(includeContent && { content: s.record.content }),
            category: s.record.category,
            type: s.record.type,
            raterType: s.userId === LLM_SYSTEM_UUID ? 'LLM' : 'Human',
            rater: s.userId === LLM_SYSTEM_UUID ? s.llmModel : userEmailMap.get(s.userId) || s.userId,
            realismScore: s.realismScore,
            qualityScore: s.qualityScore,
            createdAt: s.createdAt.toISOString()
        }));

        if (format === 'json') {
            return NextResponse.json({
                project: project.name,
                exportedAt: new Date().toISOString(),
                totalScores: exportData.length,
                data: exportData
            });
        }

        // CSV format
        const headers = [
            'recordId',
            ...(includeContent ? ['content'] : []),
            'category',
            'type',
            'raterType',
            'rater',
            'realismScore',
            'qualityScore',
            'createdAt'
        ];

        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = [
            headers.join(','),
            ...exportData.map(row =>
                headers.map(h => escapeCSV((row as any)[h])).join(',')
            )
        ];

        const csv = csvRows.join('\n');
        const filename = `likert-scores-${project.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
    }
}
