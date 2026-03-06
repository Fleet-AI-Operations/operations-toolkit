import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

async function requireFleetAuth(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { profile, user };
}

export async function GET(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';
    const envKey = searchParams.get('envKey') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (envKey) {
      where.envKey = envKey;
    }

    // Add search filter for name or email
    if (search) {
      where.OR = [
        { createdByName: { contains: search, mode: 'insensitive' } },
        { createdByEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add analysis status filters
    if (filter === 'non-native') {
      where.isLikelyNonNative = true;
    } else if (filter === 'ai-generated') {
      where.isLikelyAIGenerated = true;
    } else if (filter === 'flagged') {
      // Need to handle OR with search differently
      if (search) {
        where.AND = [
          {
            OR: [
              { createdByName: { contains: search, mode: 'insensitive' } },
              { createdByEmail: { contains: search, mode: 'insensitive' } },
            ],
          },
          {
            OR: [
              { isLikelyNonNative: true },
              { isLikelyAIGenerated: true },
            ],
          },
        ];
        delete where.OR;
      } else {
        where.OR = [
          { isLikelyNonNative: true },
          { isLikelyAIGenerated: true },
        ];
      }
    } else if (filter === 'templated') {
      where.isLikelyTemplated = true;
    } else if (filter === 'completed') {
      where.analysisStatus = 'COMPLETED';
    }

    // Get results
    const [results, total] = await Promise.all([
      prisma.promptAuthenticityRecord.findMany({
        where,
        orderBy: { analyzedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promptAuthenticityRecord.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.promptAuthenticityRecord.aggregate({
      _count: { id: true },
      where: { analysisStatus: 'COMPLETED' },
    });

    const [nonNativeCount, aiGeneratedCount, templatedCount] = await Promise.all([
      prisma.promptAuthenticityRecord.count({ where: { isLikelyNonNative: true } }),
      prisma.promptAuthenticityRecord.count({ where: { isLikelyAIGenerated: true } }),
      prisma.promptAuthenticityRecord.count({ where: { isLikelyTemplated: true } }),
    ]);

    return NextResponse.json({
      results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        totalAnalyzed: stats._count.id,
        flaggedNonNative: nonNativeCount,
        flaggedAIGenerated: aiGeneratedCount,
        flaggedTemplated: templatedCount,
      },
    });
  } catch (error: any) {
    console.error('Get results error:', error);
    return NextResponse.json(
      { error: 'Failed to get results', details: error.message },
      { status: 500 },
    );
  }
}
