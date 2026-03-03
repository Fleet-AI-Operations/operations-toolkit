import { NextRequest, NextResponse } from 'next/server';
import { RecordCategory, RecordType } from '@prisma/client';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        const { searchParams } = new URL(req.url);
        const environment = searchParams.get('environment');
        const category = searchParams.get('category') as RecordCategory | null;
        const includeReviewed = searchParams.get('includeReviewed') === 'true';

        const whereClause: any = {
            type: RecordType.TASK,
            category: {
                in: ['TOP_10', 'BOTTOM_10']
            }
        };

        // Filter by environment if provided
        if (environment && environment.trim() !== "" && environment !== "undefined") {
            whereClause.environment = environment;
        }

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
