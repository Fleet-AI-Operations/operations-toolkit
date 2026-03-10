import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

export const dynamic = 'force-dynamic';

const RAPID_THRESHOLD_MS = 5 * 60 * 1000;

function computeRapidFlags(timestamps: Date[]): boolean[] {
  const flags = new Array(timestamps.length).fill(false);
  for (let i = 1; i < timestamps.length; i++) {
    const gapMs = timestamps[i].getTime() - timestamps[i - 1].getTime();
    if (gapMs < RAPID_THRESHOLD_MS) {
      flags[i - 1] = true;
      flags[i] = true;
    }
  }
  return flags;
}

function deduplicateByTaskKey<T extends { createdAt: Date; metadata: any }>(records: T[]): T[] {
  const byKey = new Map<string, T>();
  const noKey: T[] = [];
  for (const r of records) {
    const taskKey = (r.metadata as Record<string, any> | null)?.task_key;
    if (!taskKey) { noKey.push(r); continue; }
    const existing = byKey.get(taskKey);
    if (!existing || r.createdAt > existing.createdAt) byKey.set(taskKey, r);
  }
  return [...byKey.values(), ...noKey].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * GET /api/workforce-monitoring/deep-dive?email=...&environment=...
 *
 * Returns deep-dive analysis data for a worker. Requires FLEET or higher role.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const environment = searchParams.get('environment') || undefined;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const where: any = {
      type: 'TASK',
      createdByEmail: { equals: email, mode: 'insensitive' },
    };
    if (environment) where.environment = environment;

    const dataRecords = await prisma.dataRecord.findMany({
      where,
      select: {
        id: true,
        content: true,
        environment: true,
        metadata: true,
        createdByEmail: true,
        createdByName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const deduped = deduplicateByTaskKey(dataRecords);

    if (deduped.length === 0) {
      return NextResponse.json({
        user: { email, name: null },
        tasks: [],
        summary: {
          total: 0, analyzed: 0,
          aiGeneratedCount: 0, aiGeneratedPct: 0,
          templatedCount: 0, templatedPct: 0,
          nonNativeCount: 0, nonNativePct: 0,
          rapidSubmissionCount: 0, rapidSubmissionPct: 0,
        },
      });
    }

    const userName = deduped.find(r => r.createdByName)?.createdByName ?? null;

    const analysisWhere: any = {
      createdByEmail: { equals: email, mode: 'insensitive' },
      analysisStatus: 'COMPLETED',
    };
    if (environment) analysisWhere.envKey = environment;

    const analysisRecords = await prisma.promptAuthenticityRecord.findMany({
      where: analysisWhere,
      select: {
        prompt: true,
        isLikelyAIGenerated: true,
        aiGeneratedConfidence: true,
        aiGeneratedIndicators: true,
        isLikelyTemplated: true,
        templateConfidence: true,
        templateIndicators: true,
        detectedTemplate: true,
        isLikelyNonNative: true,
        nonNativeConfidence: true,
        nonNativeIndicators: true,
        overallAssessment: true,
      },
    });

    const analysisMap = new Map<string, typeof analysisRecords[0]>();
    for (const a of analysisRecords) {
      analysisMap.set(a.prompt.trim(), a);
    }

    const timestamps = deduped.map(r => r.createdAt);
    const rapidFlags = computeRapidFlags(timestamps);

    const tasks = deduped.map((record, i) => {
      const analysis = analysisMap.get(record.content.trim()) ?? null;
      const gapFromPreviousMs = i === 0 ? null : timestamps[i].getTime() - timestamps[i - 1].getTime();
      return {
        id: record.id,
        content: record.content,
        environment: record.environment,
        createdAt: record.createdAt.toISOString(),
        gapFromPreviousMin: gapFromPreviousMs !== null ? Math.round(gapFromPreviousMs / 60000 * 10) / 10 : null,
        isRapidSubmission: rapidFlags[i],
        analysisStatus: analysis ? 'COMPLETED' : 'PENDING',
        isLikelyAIGenerated: analysis?.isLikelyAIGenerated ?? null,
        aiGeneratedConfidence: analysis ? Number(analysis.aiGeneratedConfidence ?? 0) : null,
        aiGeneratedIndicators: analysis?.aiGeneratedIndicators ?? null,
        isLikelyTemplated: analysis?.isLikelyTemplated ?? null,
        templateConfidence: analysis ? Number(analysis.templateConfidence ?? 0) : null,
        templateIndicators: analysis?.templateIndicators ?? null,
        detectedTemplate: analysis?.detectedTemplate ?? null,
        isLikelyNonNative: analysis?.isLikelyNonNative ?? null,
        nonNativeConfidence: analysis ? Number(analysis.nonNativeConfidence ?? 0) : null,
        nonNativeIndicators: analysis?.nonNativeIndicators ?? null,
        overallAssessment: analysis?.overallAssessment ?? null,
      };
    });

    const total = tasks.length;
    const analyzed = tasks.filter(t => t.analysisStatus === 'COMPLETED').length;
    const aiGeneratedCount = tasks.filter(t => t.isLikelyAIGenerated).length;
    const templatedCount = tasks.filter(t => t.isLikelyTemplated).length;
    const nonNativeCount = tasks.filter(t => t.isLikelyNonNative).length;
    const rapidSubmissionCount = tasks.filter(t => t.isRapidSubmission).length;
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    return NextResponse.json({
      user: { email, name: userName },
      tasks,
      summary: {
        total, analyzed,
        aiGeneratedCount, aiGeneratedPct: pct(aiGeneratedCount),
        templatedCount, templatedPct: pct(templatedCount),
        nonNativeCount, nonNativePct: pct(nonNativeCount),
        rapidSubmissionCount, rapidSubmissionPct: pct(rapidSubmissionCount),
      },
    });
  } catch (err) {
    console.error('[workforce-monitoring/deep-dive] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
