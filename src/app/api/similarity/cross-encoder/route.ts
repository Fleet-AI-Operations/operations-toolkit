import { NextRequest, NextResponse } from 'next/server';
import { computeCrossEncoderSimilarity } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, targetId, sourceContent, targetContent } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 });
    }

    // Check cache (both directions)
    const existing = await prisma.crossEncoderCache.findFirst({
      where: {
        OR: [
          { sourceRecordId: sourceId, targetRecordId: targetId },
          { sourceRecordId: targetId, targetRecordId: sourceId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ score: existing.score, reasoning: existing.reasoning, llmModel: existing.llmModel, cached: true });
    }

    // Cache miss: require content to compute
    if (!sourceContent || !targetContent) {
      return NextResponse.json({ error: 'sourceContent and targetContent required when cache miss' }, { status: 400 });
    }

    const result = await computeCrossEncoderSimilarity(sourceContent, targetContent);

    // Persist cache record
    try {
      await prisma.crossEncoderCache.create({
        data: {
          sourceRecordId: sourceId,
          targetRecordId: targetId,
          score: result.score,
          reasoning: result.reasoning || '',
          llmModel: result.llmModel || undefined,
        },
      });
    } catch (dbErr) {
      console.error('Failed to persist cross-encoder cache:', dbErr);
    }

    return NextResponse.json({ score: result.score, reasoning: result.reasoning, llmModel: result.llmModel, cached: false });
  } catch (error) {
    console.error('Error computing cross-encoder score:', error);
    return NextResponse.json({ error: 'Failed to compute cross-encoder score' }, { status: 500 });
  }
}
