import { NextRequest, NextResponse } from 'next/server';
import { RecordCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
                likertScores: {
                    select: {
                        realismScore: true,
                        qualityScore: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Calculate averages from the included likertScores
        const recordsWithScores = records.map((record) => {
            const likertScores = record.likertScores;

            const avgRealism = likertScores.length > 0
                ? likertScores.reduce((sum: number, s: { realismScore: number; qualityScore: number }) => sum + s.realismScore, 0) / likertScores.length
                : null;

            const avgQuality = likertScores.length > 0
                ? likertScores.reduce((sum: number, s: { realismScore: number; qualityScore: number }) => sum + s.qualityScore, 0) / likertScores.length
                : null;

            return {
                id: record.id,
                content: record.content,
                category: record.category,
                source: record.source,
                metadata: record.metadata,
                alignmentAnalysis: record.alignmentAnalysis,
                isCategoryCorrect: record.isCategoryCorrect,
                hasBeenReviewed: record.hasBeenReviewed,
                reviewedBy: record.reviewedBy,
                likertScores: {
                    count: likertScores.length,
                    avgRealism: avgRealism ? parseFloat(avgRealism.toFixed(1)) : null,
                    avgQuality: avgQuality ? parseFloat(avgQuality.toFixed(1)) : null,
                },
            };
        });

        return NextResponse.json({ records: recordsWithScores, total: recordsWithScores.length });
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch records' },
            { status: 500 }
        );
    }
}
