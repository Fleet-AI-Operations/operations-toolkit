import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const LLM_SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * GET /api/analytics/likert-summary
 * Get aggregated Likert score statistics
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Get all Likert scores for this project
        const scores = await prisma.likertScore.findMany({
            where: {
                record: { projectId }
            },
            select: {
                userId: true,
                realismScore: true,
                qualityScore: true,
                llmModel: true,
                recordId: true
            }
        });

        // Separate human and LLM scores
        const humanScores = scores.filter(s => s.userId !== LLM_SYSTEM_UUID);
        const llmScores = scores.filter(s => s.userId === LLM_SYSTEM_UUID);

        // Calculate statistics
        const calcStats = (values: number[]) => {
            if (values.length === 0) return { mean: 0, median: 0, stdDev: 0, count: 0 };
            const sorted = [...values].sort((a, b) => a - b);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const median = sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            return { mean: Math.round(mean * 100) / 100, median, stdDev: Math.round(stdDev * 100) / 100, count: values.length };
        };

        // Score distribution (1-7)
        const distribution = {
            human: {
                realism: Array(7).fill(0),
                quality: Array(7).fill(0)
            },
            llm: {
                realism: Array(7).fill(0),
                quality: Array(7).fill(0)
            }
        };

        humanScores.forEach(s => {
            distribution.human.realism[s.realismScore - 1]++;
            distribution.human.quality[s.qualityScore - 1]++;
        });

        llmScores.forEach(s => {
            distribution.llm.realism[s.realismScore - 1]++;
            distribution.llm.quality[s.qualityScore - 1]++;
        });

        // Unique raters and records
        const humanRaters = new Set(humanScores.map(s => s.userId));
        const llmModels = new Set(llmScores.map(s => s.llmModel).filter(Boolean));
        const ratedRecords = new Set(scores.map(s => s.recordId));

        // Total records in project
        const totalRecords = await prisma.dataRecord.count({
            where: { projectId }
        });

        return NextResponse.json({
            summary: {
                totalRecords,
                ratedRecords: ratedRecords.size,
                humanRaters: humanRaters.size,
                llmModels: llmModels.size,
                totalHumanRatings: humanScores.length,
                totalLLMRatings: llmScores.length
            },
            humanStats: {
                realism: calcStats(humanScores.map(s => s.realismScore)),
                quality: calcStats(humanScores.map(s => s.qualityScore))
            },
            llmStats: {
                realism: calcStats(llmScores.map(s => s.realismScore)),
                quality: calcStats(llmScores.map(s => s.qualityScore))
            },
            distribution
        });
    } catch (error) {
        console.error('Error fetching Likert summary:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
