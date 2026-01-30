import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  try {
    const { recordId, isCategoryCorrect, reviewedBy } = await req.json();

    if (!recordId || isCategoryCorrect === undefined) {
      return NextResponse.json(
        { error: 'recordId and isCategoryCorrect are required' },
        { status: 400 }
      );
    }

    // Set the hasBeenReviewed flag to true and update isCategoryCorrect
    const updatedRecord = await prisma.dataRecord.update({
      where: { id: recordId },
      data: {
        hasBeenReviewed: true,
        isCategoryCorrect: Boolean(isCategoryCorrect),
        updatedAt: new Date(),
        // TODO: Update to track actual authenticated user from Supabase session
        // Auth is implemented via Supabase, but user tracking in review flow is pending
        reviewedBy: reviewedBy || 'admin',
      },
    });

    return NextResponse.json({
      success: true,
      record: updatedRecord,
    });
  } catch (error) {
    console.error('Error updating record:', error);
    return NextResponse.json(
      { error: 'Failed to update record' },
      { status: 500 }
    );
  }
}
