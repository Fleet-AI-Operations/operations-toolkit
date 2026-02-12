import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user has FLEET or higher role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        if (!profile || !['FLEET', 'ADMIN'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { prompt1, prompt2 } = await req.json();

        if (!prompt1 || !prompt2) {
            return NextResponse.json({ error: 'Both prompts are required' }, { status: 400 });
        }

        // Prepare AI prompt
        const systemPrompt = `You are an expert at analyzing text similarity. Compare the two prompts provided and identify:
1. Key similarities between them
2. Notable differences
3. Whether they appear to be duplicate/redundant tasks
4. Your overall assessment of how similar they are

Be concise and focus on meaningful insights.`;

        const userPrompt = `Please analyze the similarity between these two prompts:

**Prompt 1:**
${prompt1}

**Prompt 2:**
${prompt2}

Provide a clear analysis of their similarity.`;

        // Use the shared AI service which handles provider selection automatically
        const result = await generateCompletionWithUsage(userPrompt, systemPrompt);

        // Format cost for display
        let costDisplay = null;
        if (result.usage?.cost) {
            costDisplay = `$${result.usage.cost.toFixed(4)}`;
        }

        return NextResponse.json({
            analysis: result.content,
            cost: costDisplay,
            provider: result.provider
        });
    } catch (error: any) {
        console.error('[AI Compare] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
