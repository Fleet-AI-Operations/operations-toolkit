import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("recordId");
    const LLMUserId = "00000000-0000-0000-0000-000000000000"; // Reserved UUID for LLM system user

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId is required" },
        { status: 400 }
      );
    }

    // Query all LLM evaluations for this record (userId = reserved LLM UUID)
    const evaluations = await prisma.likertScore.findMany({
      where: {
        recordId,
        userId: LLMUserId, // LLM system user
      },
      select: {
        llmModel: true,
      },
    });

    const evaluatedModels = evaluations
      .map((e: { llmModel: string | null }) => e.llmModel)
      .filter((model: string | null) => model !== null) as string[];

    return NextResponse.json({ evaluatedModels });
  } catch (error) {
    console.error("Error fetching LLM evaluation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation history" },
      { status: 500 }
    );
  }
}
