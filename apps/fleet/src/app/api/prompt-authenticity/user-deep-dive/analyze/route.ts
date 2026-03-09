import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { analyzePromptAuthenticity } from '@repo/core';

export const maxDuration = 300;

type UserRole = 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';
const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1, QA: 2, CORE: 3, FLEET: 4, MANAGER: 4, ADMIN: 5,
};
function hasPermission(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole as UserRole] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}

async function requireFleetAuth(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !hasPermission(profile.role, 'FLEET')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

const CONCURRENT_ANALYSES = 15;

// For each task_key in metadata, keep only the DataRecord with the latest createdAt.
function deduplicateByTaskKey<T extends { createdAt: Date; metadata: any }>(records: T[]): T[] {
  const byKey = new Map<string, T>();
  const noKey: T[] = [];
  for (const r of records) {
    const taskKey = (r.metadata as Record<string, any> | null)?.task_key;
    if (!taskKey) { noKey.push(r); continue; }
    const existing = byKey.get(taskKey);
    if (!existing || r.createdAt > existing.createdAt) byKey.set(taskKey, r);
  }
  // Re-sort chronologically to match the GET route's ordering
  return [...byKey.values(), ...noKey].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * POST /api/prompt-authenticity/user-deep-dive/analyze
 *
 * Syncs a user's DataRecord tasks into PromptAuthenticityRecord (if not already
 * present), then runs AI analysis on all PENDING records for that user.
 *
 * Body: { email: string, environment?: string }
 * Returns: { synced, analyzed, failed, total }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  let email: string;
  let environment: string | undefined;

  try {
    const body = await request.json();
    email = body.email;
    environment = body.environment;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  if (email.toLowerCase().endsWith('@fleet.so')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // ── 1. Fetch DataRecord tasks for this user ─────────────────────────────
    const where: any = {
      type: 'TASK',
      createdByEmail: { equals: email, mode: 'insensitive' },
    };
    if (environment) where.environment = environment;

    const allRecords = await prisma.dataRecord.findMany({
      where,
      select: {
        id: true,
        content: true,
        environment: true,
        metadata: true,
        createdByName: true,
        createdByEmail: true,
        createdAt: true,
      },
    });

    if (allRecords.length === 0) {
      return NextResponse.json({ error: 'No tasks found for this user' }, { status: 400 });
    }

    const dataRecords = deduplicateByTaskKey(allRecords);

    // ── 2. Sync to PromptAuthenticityRecord (skip already-present records) ──
    const syncData = dataRecords.map(r => ({
      versionId: r.id,
      taskKey: r.id,
      prompt: r.content,
      envKey: r.environment,
      createdByName: r.createdByName ?? null,
      createdByEmail: r.createdByEmail ?? null,
      createdAt: r.createdAt,
      analysisStatus: 'PENDING',
    }));

    const syncResult = await prisma.promptAuthenticityRecord.createMany({
      data: syncData,
      skipDuplicates: true,
    });

    // ── 3. Fetch all PENDING records for this user ──────────────────────────
    const pendingWhere: any = {
      createdByEmail: { equals: email, mode: 'insensitive' },
      analysisStatus: 'PENDING',
    };
    if (environment) pendingWhere.envKey = environment;

    const pending = await prisma.promptAuthenticityRecord.findMany({
      where: pendingWhere,
      select: { id: true, versionId: true, prompt: true },
    });

    if (pending.length === 0) {
      return NextResponse.json({
        synced: syncResult.count,
        analyzed: 0,
        failed: 0,
        total: dataRecords.length,
        message: 'All tasks are already analyzed.',
      });
    }

    // ── 4. Analyze in parallel chunks ───────────────────────────────────────
    let analyzed = 0;
    let failed = 0;

    const chunks = chunkArray(pending, CONCURRENT_ANALYSES);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (record) => {
          await prisma.promptAuthenticityRecord.update({
            where: { id: record.id },
            data: { analysisStatus: 'ANALYZING' },
          });

          const result = await analyzePromptAuthenticity(record.versionId, record.prompt, { silent: true });

          await prisma.promptAuthenticityRecord.update({
            where: { id: record.id },
            data: {
              analysisStatus: 'COMPLETED',
              isLikelyNonNative: result.isLikelyNonNative,
              nonNativeConfidence: result.nonNativeConfidence,
              nonNativeIndicators: result.nonNativeIndicators as any,
              isLikelyAIGenerated: result.isLikelyAIGenerated,
              aiGeneratedConfidence: result.aiGeneratedConfidence,
              aiGeneratedIndicators: result.aiGeneratedIndicators as any,
              isLikelyTemplated: result.isLikelyTemplated,
              templateConfidence: result.templateConfidence,
              templateIndicators: result.templateIndicators as any,
              detectedTemplate: result.detectedTemplate,
              overallAssessment: result.overallAssessment,
              recommendations: result.recommendations as any,
              llmModel: result.llmModel,
              llmProvider: result.llmProvider,
              llmCost: result.llmCost,
              analyzedAt: new Date(),
            },
          });
        })
      );

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          analyzed++;
        } else {
          failed++;
          console.error('[user-deep-dive/analyze] Record failed:', chunk[i].id, r.reason);
          await prisma.promptAuthenticityRecord.update({
            where: { id: chunk[i].id },
            data: {
              analysisStatus: 'FAILED',
              errorMessage: r.reason instanceof Error ? r.reason.message : 'Unknown error',
            },
          }).catch((resetErr) => {
            console.error('[user-deep-dive/analyze] Failed to reset record to FAILED status:', chunk[i].id, resetErr);
          });
        }
      }
    }

    return NextResponse.json({
      synced: syncResult.count,
      analyzed,
      failed,
      total: dataRecords.length,
      message: `Analyzed ${analyzed} task${analyzed !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`,
    });
  } catch (error: any) {
    console.error('[user-deep-dive/analyze] POST failed:', error);
    return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 });
  }
}
