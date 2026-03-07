import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';
import { logAudit } from '@repo/core/audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CORE', 'FLEET', 'MANAGER', 'ADMIN'];

const SYSTEM_PROMPT = `You are an expert at analyzing prompt similarity for AI task evaluation.
Compare the two prompts provided and deliver a structured analysis covering:
1. Key similarities — shared objectives, phrasing, or constraints
2. Notable differences — scope, specifics, or intent that differ
3. Duplicate assessment — whether these represent the same task or genuinely distinct work
4. Overall verdict — a clear recommendation on how to handle the flag

Be concise and actionable. Focus on meaningful insights for a QA reviewer.`;

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile?.role || !ALLOWED_ROLES.includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { sourceRecordId, matchedRecordId } = await req.json();

        if (!sourceRecordId || !matchedRecordId) {
            return NextResponse.json({ error: 'sourceRecordId and matchedRecordId are required' }, { status: 400 });
        }

        const [source, matched] = await Promise.all([
            prisma.dataRecord.findUnique({ where: { id: sourceRecordId }, select: { content: true } }),
            prisma.dataRecord.findUnique({ where: { id: matchedRecordId }, select: { content: true } }),
        ]);

        if (!source) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });
        if (!matched) return NextResponse.json({ error: 'Matched record not found' }, { status: 404 });

        const userPrompt = `Please analyse the similarity between these two prompts:

**Prompt 1 (Source):**
${source.content}

**Prompt 2 (Match):**
${matched.content}`;

        const result = await generateCompletionWithUsage(userPrompt, SYSTEM_PROMPT);

        await logAudit({
            action: 'AI_SIMILARITY_COMPARE',
            entityType: 'AI_REQUEST',
            userId: user.id,
            userEmail: user.email!,
            metadata: { provider: result.provider, sourceRecordId, matchedRecordId },
        });

        return NextResponse.json({
            analysis: result.content,
            cost: result.usage?.cost ? `$${result.usage.cost.toFixed(4)}` : null,
            provider: result.provider,
        });
    } catch (error: any) {
        console.error('[Similarity Flags AI Compare] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
