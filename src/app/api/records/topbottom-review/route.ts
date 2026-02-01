import { NextRequest, NextResponse } from 'next/server';
import { RecordCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type RecordWithoutScores = {
    id: string;
    content: string;
    category: RecordCategory | null;
    source: string;
    metadata: Prisma.JsonValue;
    alignmentAnalysis: string | null;
    isCategoryCorrect: boolean | null;
    hasBeenReviewed: boolean;
    reviewedBy: string | null;
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const category = searchParams.get('category') as RecordCategory | null;
        const includeReviewed = searchParams.get('includeReviewed') === 'true';

        if (!projectId || projectId.trim() === "" || projectId === "undefined") {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        const whereClause: any = {
            projectId,
            category: {
                in: ['TOP_10', 'BOTTOM_10']
            }
        };

        // Only filter by review status if not including reviewed records
        if (!includeReviewed) {
            whereClause.hasBeenReviewed = false;
        }

        if (category === 'TOP_10' || category === 'BOTTOM_10') {
            whereClause.category = category;
        }

        const records = await prisma.dataRecord.findMany({
            where: whereClause,
            select: {
                id: true,
                content: true,
                category: true,
                source: true,
                metadata: true,
                alignmentAnalysis: true,
                isCategoryCorrect: true,
                hasBeenReviewed: true,
                reviewedBy: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Fetch Likert scores for each record and calculate averages
        const recordsWithScores = await Promise.all(
            records.map(async (record: RecordWithoutScores) => {
                const likertScores = await prisma.likertScore.findMany({
                    where: { recordId: record.id },
                    select: {
                        realismScore: true,
                        qualityScore: true,
                    },
                });

                const avgRealism = likertScores.length > 0
                    ? likertScores.reduce((sum: number, s: { realismScore: number; qualityScore: number }) => sum + s.realismScore, 0) / likertScores.length
                    : null;

                const avgQuality = likertScores.length > 0
                    ? likertScores.reduce((sum: number, s: { realismScore: number; qualityScore: number }) => sum + s.qualityScore, 0) / likertScores.length
                    : null;

                return {
                    ...record,
                    likertScores: {
                        count: likertScores.length,
                        avgRealism: avgRealism ? parseFloat(avgRealism.toFixed(1)) : null,
                        avgQuality: avgQuality ? parseFloat(avgQuality.toFixed(1)) : null,
                    },
                };
            })
        );

        return NextResponse.json({ records: recordsWithScores, total: recordsWithScores.length });
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch records' },
            { status: 500 }
        );
    }
}
