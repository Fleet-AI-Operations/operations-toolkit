import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch unrated prompts for the current user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // Get all record IDs that this user has already rated
    const ratedRecordIds = await prisma.likertScore.findMany({
      where: { userId },
      select: { recordId: true },
    });

    const ratedIds = ratedRecordIds.map((r: { recordId: string }) => r.recordId);

    // Fetch records that haven't been rated by this user
    const unratedRecords = await prisma.dataRecord.findMany({
      where: {
        projectId,
        type: 'TASK',
        id: {
          notIn: ratedIds,
        },
      },
      select: {
        id: true,
        content: true,
        category: true,
        source: true,
        metadata: true,
        createdAt: true,
        isCategoryCorrect: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ records: unratedRecords });
  } catch (error) {
    console.error('Error fetching unrated records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

// POST: Submit Likert scores
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordId, userId, realismScore, qualityScore } = body;

    // Validate input
    if (!recordId || !userId || !realismScore || !qualityScore) {
      return NextResponse.json(
        { error: 'Missing required fields: recordId, userId, realismScore, qualityScore' },
        { status: 400 }
      );
    }

    // Validate score ranges (1-7)
    if (
      realismScore < 1 || realismScore > 7 ||
      qualityScore < 1 || qualityScore > 7
    ) {
      return NextResponse.json(
        { error: 'Scores must be between 1 and 7' },
        { status: 400 }
      );
    }

    // Create the Likert score entry
    const likertScore = await prisma.likertScore.create({
      data: {
        id: `lks_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId,
        userId,
        realismScore: parseInt(realismScore),
        qualityScore: parseInt(qualityScore),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      likertScore,
    });
  } catch (error: any) {
    console.error('Error saving Likert score:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already rated this prompt' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save Likert score' },
      { status: 500 }
    );
  }
}
