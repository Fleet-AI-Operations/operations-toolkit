import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAudit, checkAuditResult } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Only ADMIN can clear data
    const authResult = await requireRole('ADMIN');
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try{
        const { target, projectId } = await req.json();

        if (target === 'ALL_DATA') {
            // Delete all records, Likert scores, and reset project analysis
            await prisma.$transaction([
                prisma.likertScore.deleteMany({}),
                prisma.dataRecord.deleteMany({}),
                prisma.project.updateMany({
                    data: {
                        lastTaskAnalysis: null,
                        lastFeedbackAnalysis: null
                    }
                })
            ]);

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'DATA_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email,
                metadata: { target: 'ALL_DATA', includedLikertScores: true }
            });

            checkAuditResult(auditResult, 'DATA_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All record data, Likert scores, and analytics cleared successfully.' });
        }

        if (target === 'ANALYTICS_ONLY') {
            // Reset project analysis only
            await prisma.project.updateMany({
                data: {
                    lastTaskAnalysis: null,
                    lastFeedbackAnalysis: null
                }
            });

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'ANALYTICS_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email,
                metadata: { target: 'ANALYTICS_ONLY' }
            });

            checkAuditResult(auditResult, 'ANALYTICS_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All saved analytics cleared successfully.' });
        }

        if (target === 'LIKERT_SCORES') {
            // Delete Likert scores (optionally for a specific project)
            if (projectId) {
                // Get record IDs for this project first
                const records = await prisma.dataRecord.findMany({
                    where: { projectId },
                    select: { id: true }
                });
                const recordIds = records.map(r => r.id);

                const result = await prisma.likertScore.deleteMany({
                    where: { recordId: { in: recordIds } }
                });

                const auditResult = await logAudit({
                    action: 'LIKERT_SCORES_CLEARED',
                    entityType: 'LIKERT_SCORE',
                    projectId,
                    userId: user.id,
                    userEmail: user.email,
                    metadata: { projectId, count: result.count }
                });

                checkAuditResult(auditResult, 'LIKERT_SCORES_CLEARED', {
                    userId: user.id
                });

                return NextResponse.json({
                    message: `Cleared ${result.count} Likert scores for this project.`,
                    count: result.count
                });
            } else {
                // Clear all Likert scores
                const result = await prisma.likertScore.deleteMany({});

                const auditResult = await logAudit({
                    action: 'LIKERT_SCORES_CLEARED',
                    entityType: 'LIKERT_SCORE',
                    userId: user.id,
                    userEmail: user.email,
                    metadata: { target: 'ALL', count: result.count }
                });

                checkAuditResult(auditResult, 'LIKERT_SCORES_CLEARED', {
                    userId: user.id
                });

                return NextResponse.json({
                    message: `Cleared all ${result.count} Likert scores.`,
                    count: result.count
                });
            }
        }

        if (target === 'PROJECT_RECORDS') {
            // Delete all records and their Likert scores for a specific project
            if (!projectId) {
                return NextResponse.json({ error: 'projectId required for PROJECT_RECORDS' }, { status: 400 });
            }

            // Get record IDs first for Likert score deletion
            const records = await prisma.dataRecord.findMany({
                where: { projectId },
                select: { id: true }
            });
            const recordIds = records.map(r => r.id);

            // Delete in transaction: Likert scores first (due to foreign key), then records
            const [likertResult, recordResult] = await prisma.$transaction([
                prisma.likertScore.deleteMany({
                    where: { recordId: { in: recordIds } }
                }),
                prisma.dataRecord.deleteMany({
                    where: { projectId }
                })
            ]);

            // Reset project analysis
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    lastTaskAnalysis: null,
                    lastFeedbackAnalysis: null
                }
            });

            const auditResult = await logAudit({
                action: 'PROJECT_RECORDS_CLEARED',
                entityType: 'DATA_RECORD',
                projectId,
                userId: user.id,
                userEmail: user.email,
                metadata: {
                    projectId,
                    recordsDeleted: recordResult.count,
                    likertScoresDeleted: likertResult.count
                }
            });

            checkAuditResult(auditResult, 'PROJECT_RECORDS_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({
                message: `Cleared ${recordResult.count} records and ${likertResult.count} Likert scores for this project.`,
                recordsDeleted: recordResult.count,
                likertScoresDeleted: likertResult.count
            });
        }

        return NextResponse.json({ error: 'Invalid clear target' }, { status: 400 });
    } catch (error: any) {
        console.error('Admin Clear API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
