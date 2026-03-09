import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { createClient } from "@repo/auth/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Users may only check their own submission status
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
