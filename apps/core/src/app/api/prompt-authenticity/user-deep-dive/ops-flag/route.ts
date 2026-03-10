import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { hasMinRole } from '@repo/auth';
import { prisma } from '@repo/database';

/**
 * POST /api/prompt-authenticity/user-deep-dive/ops-flag
 *
 * Creates a REVIEW_REQUESTED WorkerFlag for a task's creator, surfacing it in
 * the Fleet workforce monitoring flags tab. Requires CORE or higher role.
 *
 * Body: {
 *   workerEmail: string,
 *   workerName?:  string,
 *   reason?:      string,  -- optional context shown in the flag
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[user-deep-dive/ops-flag] Profile fetch failed:', profileError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    if (!profile || !hasMinRole(profile.role, 'CORE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { workerEmail, workerName, reason } = body;

    if (!workerEmail) {
      return NextResponse.json({ error: 'workerEmail is required' }, { status: 400 });
    }

    const flag = await prisma.workerFlag.create({
      data: {
        workerEmail,
        workerName: workerName ?? null,
        flagType: 'REVIEW_REQUESTED',
        severity: 'MEDIUM',
        reason: reason?.trim() || 'Flagged for ops review from Task Creator Deep-Dive.',
        status: 'OPEN',
        createdById: user.id,
        createdByEmail: profile.email,
      },
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (err) {
    console.error('[user-deep-dive/ops-flag] POST failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
