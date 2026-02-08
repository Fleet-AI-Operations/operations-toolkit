import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const LLM_SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * GET /api/analytics/model-comparison
 * Compare LLM model ratings with human ratings
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

        // Get all scores grouped by record
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

        // Group by record
        const byRecord = new Map<string, {
            humanScores: { realism: number; quality: number }[];
            llmScores: { model: string; realism: number; quality: number }[];
        }>();

        scores.forEach(s => {
            if (!byRecord.has(s.recordId)) {
                byRecord.set(s.recordId, { humanScores: [], llmScores: [] });
            }
            const record = byRecord.get(s.recordId)!;
            if (s.userId === LLM_SYSTEM_UUID) {
                record.llmScores.push({
                    model: s.llmModel || 'unknown',
                    realism: s.realismScore,
                    quality: s.qualityScore
                });
            } else {
                record.humanScores.push({
                    realism: s.realismScore,
                    quality: s.qualityScore
                });
            }
        });

        // Get unique models
        const modelSet = new Set<string>();
        scores.forEach(s => {
            if (s.userId === LLM_SYSTEM_UUID && s.llmModel) {
                modelSet.add(s.llmModel);
            }
        });
        const models = Array.from(modelSet);

        // Calculate per-model statistics
        const modelStats: Record<string, {
            name: string;
            totalRatings: number;
            avgRealism: number;
            avgQuality: number;
            correlationWithHuman: { realism: number; quality: number } | null;
        }> = {};

        models.forEach(model => {
            const modelScores = scores.filter(s => s.llmModel === model);
            const avgRealism = modelScores.reduce((a, s) => a + s.realismScore, 0) / modelScores.length;
            const avgQuality = modelScores.reduce((a, s) => a + s.qualityScore, 0) / modelScores.length;

            // Calculate correlation with human scores for records with both
            let realismPairs: [number, number][] = [];
            let qualityPairs: [number, number][] = [];

            byRecord.forEach((data) => {
                if (data.humanScores.length > 0) {
                    const humanAvgRealism = data.humanScores.reduce((a, s) => a + s.realism, 0) / data.humanScores.length;
                    const humanAvgQuality = data.humanScores.reduce((a, s) => a + s.quality, 0) / data.humanScores.length;

                    const modelScore = data.llmScores.find(s => s.model === model);
                    if (modelScore) {
                        realismPairs.push([humanAvgRealism, modelScore.realism]);
                        qualityPairs.push([humanAvgQuality, modelScore.quality]);
                    }
                }
            });

            // Pearson correlation
            const correlation = (pairs: [number, number][]) => {
                if (pairs.length < 3) return null;
                const n = pairs.length;
                const sumX = pairs.reduce((a, p) => a + p[0], 0);
                const sumY = pairs.reduce((a, p) => a + p[1], 0);
                const sumXY = pairs.reduce((a, p) => a + p[0] * p[1], 0);
                const sumX2 = pairs.reduce((a, p) => a + p[0] * p[0], 0);
                const sumY2 = pairs.reduce((a, p) => a + p[1] * p[1], 0);

                const numerator = n * sumXY - sumX * sumY;
                const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

                if (denominator === 0) return null;
                return Math.round((numerator / denominator) * 1000) / 1000;
            };

            modelStats[model] = {
                name: model,
                totalRatings: modelScores.length,
                avgRealism: Math.round(avgRealism * 100) / 100,
                avgQuality: Math.round(avgQuality * 100) / 100,
                correlationWithHuman: {
                    realism: correlation(realismPairs) || 0,
                    quality: correlation(qualityPairs) || 0
                }
            };
        });

        // Get model configs for display names
        const modelConfigs = await prisma.lLMModelConfig.findMany({
            select: { modelId: true, name: true }
        });
        const modelNameMap = new Map(modelConfigs.map(m => [m.modelId, m.name]));

        // Add display names
        Object.values(modelStats).forEach(stat => {
            const displayName = modelNameMap.get(stat.name);
            if (displayName) {
                stat.name = displayName;
            }
        });

        return NextResponse.json({
            models: Object.values(modelStats),
            recordsWithBoth: Array.from(byRecord.values()).filter(r => r.humanScores.length > 0 && r.llmScores.length > 0).length,
            totalRecordsRated: byRecord.size
        });
    } catch (error) {
        console.error('Error fetching model comparison:', error);
        return NextResponse.json({ error: 'Failed to fetch comparison' }, { status: 500 });
    }
}
