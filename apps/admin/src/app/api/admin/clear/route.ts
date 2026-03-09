import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { logAudit, checkAuditResult } from '@repo/core/audit';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const { target, environment } = await req.json();

        if (target === 'ALL_DATA') {
            // Delete all records and Likert scores
            await prisma.$transaction([
                prisma.likertScore.deleteMany({}),
                prisma.dataRecord.deleteMany({}),
            ]);

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'DATA_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email!,
                metadata: { target: 'ALL_DATA', includedLikertScores: true }
            });

            checkAuditResult(auditResult, 'DATA_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All record data, Likert scores, and analytics cleared successfully.' });
        }

        if (target === 'ANALYTICS_ONLY') {
            // Clear alignment analysis from all data records
            await prisma.dataRecord.updateMany({
                data: { alignmentAnalysis: null }
            });

            // Log audit event (critical operation)
            const auditResult = await logAudit({
                action: 'ANALYTICS_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email!,
                metadata: { target: 'ANALYTICS_ONLY' }
            });

            checkAuditResult(auditResult, 'ANALYTICS_CLEARED', {
                userId: user.id
            });

            return NextResponse.json({ message: 'All saved analytics cleared successfully.' });
        }

        if (target === 'LIKERT_SCORES') {
            // Delete Likert scores (optionally for a specific project)
            if (environment) {
                // Get record IDs for this project first
                const records = await prisma.dataRecord.findMany({
                    where: { environment },
                    select: { id: true }
                });
                const recordIds = records.map(r => r.id);

                const result = await prisma.likertScore.deleteMany({
                    where: { recordId: { in: recordIds } }
                });

                const auditResult = await logAudit({
                    action: 'LIKERT_SCORES_CLEARED',
                    entityType: 'LIKERT_SCORE',
                    userId: user.id,
                    userEmail: user.email!,
                    metadata: { environment, count: result.count }
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
                    userEmail: user.email!,
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
            if (!environment) {
                return NextResponse.json({ error: 'environment required for PROJECT_RECORDS' }, { status: 400 });
            }

            // Get record IDs first for Likert score deletion
            const records = await prisma.dataRecord.findMany({
                where: { environment },
                select: { id: true }
            });
            const recordIds = records.map(r => r.id);

            // Delete in transaction: Likert scores first (due to foreign key), then records
            const [likertResult, recordResult] = await prisma.$transaction([
                prisma.likertScore.deleteMany({
                    where: { recordId: { in: recordIds } }
                }),
                prisma.dataRecord.deleteMany({
                    where: { environment }
                })
            ]);

            // Clear alignment analysis for records in this environment
            await prisma.dataRecord.updateMany({
                where: { environment },
                data: { alignmentAnalysis: null }
            });

            const auditResult = await logAudit({
                action: 'PROJECT_RECORDS_CLEARED',
                entityType: 'DATA_RECORD',
                userId: user.id,
                userEmail: user.email!,
                metadata: {
                    environment,
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
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
