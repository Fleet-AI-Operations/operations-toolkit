import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';

// ============================================================================
// HIERARCHICAL PERMISSION HELPER
// ============================================================================
type UserRole = 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 4,
  ADMIN: 5,
};

function hasPermission(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

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

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!hasPermission(profile.role, 'FLEET')) {
    return { error: NextResponse.json({ error: 'Forbidden - FLEET role or higher required' }, { status: 403 }) };
  }

  return { profile, user };
}

// ============================================================================
// GET: Aggregate per-user stats from analyzed records
// ============================================================================
export async function GET(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const minPrompts = parseInt(searchParams.get('minPrompts') || '2');
    const envKey = searchParams.get('envKey') || undefined;

    // Get all analyzed records grouped by email
    const where: any = {
      analysisStatus: 'COMPLETED',
      createdByEmail: { not: null },
    };
    if (envKey) where.envKey = envKey;

    const records = await prisma.promptAuthenticityRecord.findMany({
      where,
      select: {
        createdByEmail: true,
        createdByName: true,
        isLikelyNonNative: true,
        isLikelyAIGenerated: true,
        isLikelyTemplated: true,
        templateConfidence: true,
        envKey: true,
      },
    });

    // Aggregate per user
    const userMap = new Map<string, {
      email: string;
      name: string | null;
      total: number;
      nonNative: number;
      aiGenerated: number;
      templated: number;
      totalTemplateConfidence: number;
      environments: Set<string>;
    }>();

    for (const r of records) {
      if (!r.createdByEmail) continue;
      const key = r.createdByEmail.toLowerCase();

      if (!userMap.has(key)) {
        userMap.set(key, {
          email: r.createdByEmail,
          name: r.createdByName ?? null,
          total: 0,
          nonNative: 0,
          aiGenerated: 0,
          templated: 0,
          totalTemplateConfidence: 0,
          environments: new Set(),
        });
      }

      const u = userMap.get(key)!;
      u.total++;
      if (r.isLikelyNonNative) u.nonNative++;
      if (r.isLikelyAIGenerated) u.aiGenerated++;
      if (r.isLikelyTemplated) {
        u.templated++;
        u.totalTemplateConfidence += Number(r.templateConfidence ?? 0);
      }
      if (r.envKey) u.environments.add(r.envKey);
    }

    const users = Array.from(userMap.values())
      .filter(u => u.total >= minPrompts)
      .map(u => ({
        email: u.email,
        name: u.name,
        total: u.total,
        nonNative: u.nonNative,
        nonNativePct: Math.round((u.nonNative / u.total) * 100),
        aiGenerated: u.aiGenerated,
        aiGeneratedPct: Math.round((u.aiGenerated / u.total) * 100),
        templated: u.templated,
        templatedPct: Math.round((u.templated / u.total) * 100),
        avgTemplateConfidence: u.templated > 0
          ? Math.round(u.totalTemplateConfidence / u.templated)
          : 0,
        environments: Array.from(u.environments).sort(),
      }))
      .sort((a, b) => b.templatedPct - a.templatedPct || b.total - a.total);

    return NextResponse.json({ users, total: users.length });
  } catch (error: any) {
    console.error('User patterns error:', error);
    return NextResponse.json({ error: 'Failed to get user patterns', details: error.message }, { status: 500 });
  }
}

// ============================================================================
// POST: Run cross-prompt template analysis for a specific user
// ============================================================================
const CROSS_PROMPT_TEMPLATE_PROMPT = `You are an expert at detecting templated or formulaic prompt writing patterns.

You will be given multiple prompts submitted by the same user. Analyze them as a group to determine:
1. Whether they share a common structural template or formula
2. What that template looks like (if present)
3. How strong the evidence is

CRITICAL INSTRUCTION: Respond ONLY with a valid JSON object. No markdown, no text outside the JSON.

{
  "hasCommonTemplate": true,
  "confidence": 88,
  "templateDescription": "Brief description of the pattern",
  "inferredTemplate": "The [type] should [action] [object] while [constraint]",
  "evidence": ["All prompts start with 'The X should'", "Consistent slot structure across prompts"],
  "uniquePromptCount": 3,
  "flaggedPromptIndices": [0, 1, 2],
  "assessment": "Short overall assessment"
}`;

export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { email, envKey } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const where: any = {
      createdByEmail: { equals: email, mode: 'insensitive' },
      analysisStatus: 'COMPLETED',
    };
    if (envKey) where.envKey = envKey;

    // Fetch up to 20 prompts for this user
    const records = await prisma.promptAuthenticityRecord.findMany({
      where,
      select: { id: true, prompt: true, isLikelyTemplated: true, detectedTemplate: true },
      orderBy: { analyzedAt: 'desc' },
      take: 20,
    });

    if (records.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 analyzed prompts for cross-prompt analysis' }, { status: 400 });
    }

    const promptList = records
      .map((r, i) => `[${i}] ${r.prompt.substring(0, 300)}${r.prompt.length > 300 ? '...' : ''}`)
      .join('\n\n');

    const userMessage = `Analyze these ${records.length} prompts from the same user for templated/formulaic patterns:\n\n${promptList}`;

    const response = await generateCompletionWithUsage(
      userMessage,
      CROSS_PROMPT_TEMPLATE_PROMPT,
      { silent: true }
    );

    // Extract JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in LLM response');
    }
    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      email,
      promptCount: records.length,
      analysis,
      cost: response.usage?.cost ?? 0,
      provider: response.provider,
    });
  } catch (error: any) {
    console.error('Cross-prompt analysis error:', error);
    return NextResponse.json({ error: 'Failed to run cross-prompt analysis', details: error.message }, { status: 500 });
  }
}
