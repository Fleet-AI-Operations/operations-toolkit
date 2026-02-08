import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("recordId");
    const userId = searchParams.get("userId");

    if (!recordId || !userId) {
      return NextResponse.json(
        { error: "recordId and userId are required" },
        { status: 400 }
      );
    }

    // Check if user has a Likert score for this record
    const userScore = await prisma.likertScore.findFirst({
      where: {
        recordId,
        userId,
        // Exclude LLM system UUID
        NOT: {
          userId: "00000000-0000-0000-0000-000000000000",
        },
      },
    });

    return NextResponse.json({ userScore: userScore ? true : false });
  } catch (error) {
    console.error("Error checking submission status:", error);
    return NextResponse.json(
      { error: "Failed to check submission status" },
      { status: 500 }
    );
  }
}
