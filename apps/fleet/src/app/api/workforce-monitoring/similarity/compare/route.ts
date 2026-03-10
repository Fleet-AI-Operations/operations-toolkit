import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { Prisma } from '@prisma/client';
import { cosineSimilarity } from '@repo/core/ai';

export const dynamic = 'force-dynamic';

function parseVector(embedding: any): number[] | null {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === 'string') {
    try {
      const values = embedding.replace(/[\[\]]/g, '').split(',').map(v => parseFloat(v.trim()));
      return values.filter(v => !isNaN(v));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * POST /api/workforce-monitoring/similarity/compare
 *
 * Compares a source task (by ID) against other tasks using cosine similarity.
 * Unlike the full-similarity-check compare route, source lookup is not filtered
 * by environment so it works regardless of whether the task has an environment set.
 *
 * Body: {
 *   taskId: string,
 *   scope: 'environment' | 'all',
 *   threshold: number (0–100, default 50),
 *   latestOnly: boolean,
 *   workerEmail: string,   // used to label matches as "same worker"
 * }
 *
 * Requires FLEET or higher role.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { taskId, scope, threshold, latestOnly, workerEmail } = body;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }
    if (scope !== 'environment' && scope !== 'all') {
      return NextResponse.json({ error: 'scope must be "environment" or "all"' }, { status: 400 });
    }

    const similarityThreshold = typeof threshold === 'number' && threshold >= 0 && threshold <= 100
      ? threshold : 50;

    // Fetch source task — no environment filter so it works for tasks with null environment
    type TaskWithEmbedding = {
      id: string;
      content: string;
      environment: string | null;
      metadata: any;
      embedding: any;
      createdByEmail: string | null;
      createdAt: Date;
    };

    const sourceRows = await prisma.$queryRaw<TaskWithEmbedding[]>`
      SELECT id, content, environment, metadata, embedding, "createdByEmail", "createdAt"
      FROM data_records
      WHERE id = ${taskId}
        AND type = 'TASK'
        AND embedding IS NOT NULL
    `;

    if (sourceRows.length === 0) {
      return NextResponse.json({ error: 'Task not found or has no embedding' }, { status: 404 });
    }

    const source = sourceRows[0];
    const sourceEmbedding = parseVector(source.embedding);
    if (!sourceEmbedding) {
      return NextResponse.json({ error: 'Failed to parse source task embedding' }, { status: 400 });
    }

    // Build comparison query
    let comparisonQuery: Prisma.Sql;

    if (scope === 'environment' && source.environment) {
      const env = source.environment;
      if (latestOnly) {
        comparisonQuery = Prisma.sql`
          SELECT id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
          FROM (
            SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
              id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
            FROM data_records
            WHERE LOWER(environment) = LOWER(${env})
              AND type = 'TASK'
              AND id != ${source.id}
              AND embedding IS NOT NULL
            ORDER BY COALESCE(metadata->>'task_key', id),
                     CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                     "createdAt" DESC
          ) latest
          ORDER BY "createdAt" DESC
          LIMIT 2000
        `;
      } else {
        comparisonQuery = Prisma.sql`
          SELECT id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
          FROM data_records
          WHERE LOWER(environment) = LOWER(${env})
            AND type = 'TASK'
            AND id != ${source.id}
            AND embedding IS NOT NULL
          ORDER BY "createdAt" DESC
          LIMIT 2000
        `;
      }
    } else {
      // scope === 'all' (or environment is null, fall back to all)
      if (latestOnly) {
        comparisonQuery = Prisma.sql`
          SELECT id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
          FROM (
            SELECT DISTINCT ON (COALESCE(metadata->>'task_key', id))
              id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
            FROM data_records
            WHERE type = 'TASK'
              AND id != ${source.id}
              AND embedding IS NOT NULL
            ORDER BY COALESCE(metadata->>'task_key', id),
                     CAST(COALESCE(NULLIF(metadata->>'task_version', ''), NULLIF(metadata->>'version_no', ''), '0') AS INTEGER) DESC,
                     "createdAt" DESC
          ) latest
          ORDER BY "createdAt" DESC
          LIMIT 2000
        `;
      } else {
        comparisonQuery = Prisma.sql`
          SELECT id, content, environment, metadata, embedding, "createdByName", "createdByEmail", "createdAt"
          FROM data_records
          WHERE type = 'TASK'
            AND id != ${source.id}
            AND embedding IS NOT NULL
          ORDER BY "createdAt" DESC
          LIMIT 2000
        `;
      }
    }

    type CompareRow = {
      id: string;
      content: string;
      environment: string | null;
      metadata: any;
      embedding: any;
      createdByName: string | null;
      createdByEmail: string | null;
      createdAt: Date;
    };

    const comparisonTasks = await prisma.$queryRaw<CompareRow[]>(comparisonQuery);

    const matches = [];
    for (const t of comparisonTasks) {
      if (t.content.trim() === source.content.trim()) continue; // identical content
      const vec = parseVector(t.embedding);
      if (!vec) continue;
      const sim = cosineSimilarity(sourceEmbedding, vec) * 100;
      if (isNaN(sim) || !isFinite(sim) || sim < similarityThreshold) continue;
      matches.push({
        taskId: t.id,
        content: t.content,
        environment: t.environment ?? null,
        taskKey: (t.metadata as any)?.task_key ?? null,
        createdBy: t.createdByName || t.createdByEmail || 'Unknown',
        createdByEmail: t.createdByEmail ?? null,
        isSameWorker: workerEmail && t.createdByEmail
          ? t.createdByEmail.toLowerCase() === workerEmail.toLowerCase()
          : false,
        similarity: Math.round(sim * 10) / 10,
        createdAt: t.createdAt.toISOString(),
      });
    }

    matches.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      source: {
        id: source.id,
        content: source.content,
        environment: source.environment ?? null,
        taskKey: (source.metadata as any)?.task_key ?? null,
      },
      matches,
      total: matches.length,
    });
  } catch (err) {
    console.error('[workforce-monitoring/similarity/compare] POST failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
