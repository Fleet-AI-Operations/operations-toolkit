import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

//This is temporary (maybe) unless there's another way Naman/Max want to identify LLM evaluations
const LLM_SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";

interface EvaluationRequest {
    recordId: string;
    content: string;
    models: string[]; // Array of model names to evaluate with
}

async function callLLMProvider(
    prompt: string,
    model: string
): Promise<{ realism: number; quality: number } | null> {
    try {
        const provider = process.env.LLM_PROVIDER || 'openrouter'; // Default to openrouter
        const apiHost = process.env.AI_HOST || process.env.OPENROUTER_API_URL || 'https://openrouter.io/api/v1';
        const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            console.error(`Missing API key for LLM provider: ${provider}`);
            return null;
        }

        const response = await fetch(`${apiHost}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(provider === 'openrouter' && { "Authorization": `Bearer ${apiKey}` }),
                ...(provider === 'lmstudio' && {}), // LMStudio typically doesn't require auth
            },
            body: JSON.stringify({
                model,
                // The content is subject to change, this is just an example prompt. We will likely pass in instructions in the future.
                messages: [
                    {
                        role: "system",
                        content: `You are an expert evaluator. Rate the given prompt/text on two dimensions using a 1-7 scale:
1. Realism (1=Not Realistic, 7=Very Realistic): How realistic and grounded is this prompt?
2. Quality (1=Poor Quality, 7=Excellent Quality): How well-written and useful is this prompt?

Respond in JSON format only: {"realism": <1-7>, "quality": <1-7>}`,
                    },
                    {
                        role: "user",
                        content: `Please evaluate this prompt:\n\n${prompt}`,
                    },
                ],
                temperature: 0.7,
                max_tokens: 100,
            }),
        });

        if (!response.ok) {
            console.error(`LLM provider (${provider}) error for model ${model}:`, response.statusText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error(`No content from LLM provider (${provider}) for model ${model}`);
            return null;
        }

        const parsed = JSON.parse(content);
        const realism = Math.max(1, Math.min(7, Math.round(parsed.realism)));
        const quality = Math.max(1, Math.min(7, Math.round(parsed.quality)));

        return { realism, quality };
    } catch (error) {
        console.error(`Error calling LLM provider with model ${model}:`, error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { recordId, content, models }: EvaluationRequest = await request.json();

        if (!recordId || !content || !models || models.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: recordId, content, models" },
                { status: 400 }
            );
        }

        // Evaluate with each model
        const results = [];

        for (const model of models) {
            const scores = await callLLMProvider(content, model);

            if (scores) {
                try {
                    // Save to database
                    const likertScore = await prisma.likertScore.create({
                        data: {
                            recordId,
                            userId: LLM_SYSTEM_UUID,
                            realismScore: scores.realism,
                            qualityScore: scores.quality,
                            llmModel: model,
                        },
                    });

                    results.push({
                        model,
                        realismScore: scores.realism,
                        qualityScore: scores.quality,
                        id: likertScore.id,
                    });
                } catch (dbError: any) {
                    // Check if it's a unique constraint violation
                    if (dbError?.code === 'P2002') {
                        results.push({
                            model,
                            error: "This model has already evaluated this prompt",
                        });
                    } else {
                        throw dbError;
                    }
                }
            } else {
                results.push({
                    model,
                    error: "Failed to evaluate with this model",
                });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Error in likert-llm endpoint:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
