import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';
import { logAudit } from '@repo/core/audit';
import { ERROR_IDS } from '@/constants/errorIds';

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

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[Similarity Flags AI Compare] Failed to fetch user profile:', profileError.message);
        return NextResponse.json({ error: 'Failed to verify permissions. Please try again.' }, { status: 500 });
    }

    if (!profile?.role || !ALLOWED_ROLES.includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let sourceRecordId: string, matchedRecordId: string;
    try {
        const body = await req.json();
        sourceRecordId = body.sourceRecordId;
        matchedRecordId = body.matchedRecordId;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!sourceRecordId || !matchedRecordId) {
        return NextResponse.json({ error: 'sourceRecordId and matchedRecordId are required' }, { status: 400 });
    }

    let source, matched;
    try {
        [source, matched] = await Promise.all([
            prisma.dataRecord.findUnique({ where: { id: sourceRecordId }, select: { content: true } }),
            prisma.dataRecord.findUnique({ where: { id: matchedRecordId }, select: { content: true } }),
        ]);
    } catch (dbError) {
        console.error('[Similarity Flags AI Compare] DB fetch failed:', dbError);
        return NextResponse.json({ error: 'Failed to retrieve records. Please try again.' }, { status: 500 });
    }

    if (!source) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });
    if (!matched) return NextResponse.json({ error: 'Matched record not found' }, { status: 404 });

    const userPrompt = `Please analyse the similarity between these two prompts:

**Prompt 1 (Source):**
${source.content}

**Prompt 2 (Match):**
${matched.content}`;

    let result;
    try {
        result = await generateCompletionWithUsage(userPrompt, SYSTEM_PROMPT);
    } catch (aiError) {
        console.error('[Similarity Flags AI Compare] AI call failed:', aiError);
        return NextResponse.json({ error: 'The AI service failed to respond. Check your AI provider configuration and try again.' }, { status: 502 });
    }

    if (!result.content) {
        console.error('[Similarity Flags AI Compare] AI returned empty content', { provider: result.provider });
        return NextResponse.json({ error: 'The AI returned an empty response. Please try again.' }, { status: 502 });
    }

    logAudit({
        action: 'AI_SIMILARITY_COMPARE',
        entityType: 'AI_REQUEST',
        userId: user.id,
        userEmail: user.email ?? 'unknown',
        metadata: { provider: result.provider, sourceRecordId, matchedRecordId },
    }).catch(auditErr => {
        console.error(`[${ERROR_IDS.AUDIT_LOG_FAILED}] [Similarity Flags AI Compare] Audit log failed (non-fatal):`, auditErr);
    });

    return NextResponse.json({
        analysis: result.content,
        cost: result.usage?.cost ? `$${result.usage.cost.toFixed(4)}` : null,
        provider: result.provider,
    });
}
