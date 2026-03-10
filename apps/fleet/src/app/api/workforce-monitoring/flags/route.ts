import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const VALID_FLAG_TYPES = ['QUALITY_CONCERN', 'POLICY_VIOLATION', 'COMMUNICATION_ISSUE', 'ATTENDANCE', 'OTHER'] as const;
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * GET /api/workforce-monitoring/flags?email=<email>
 *
 * Returns all flags for a specific worker.
 * Requires FLEET or higher role.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.trim();
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const flags = await prisma.workerFlag.findMany({
      where: { workerEmail: email },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ flags });
  } catch (err) {
    console.error('[workforce-monitoring/flags] GET failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/workforce-monitoring/flags
 *
 * Creates a new worker flag.
 * Requires FLEET or higher role.
 *
 * Body: { workerEmail, workerName?, flagType, severity?, reason, notes? }
 *
 * Returns:
 *   201 { flag }
 *   400 validation error
 *   401 Unauthorized
 *   403 Forbidden
 *   500 Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true, email: true },
    });
    if (!profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { workerEmail, workerName, flagType, severity = 'MEDIUM', reason, notes } = body;

    if (!workerEmail || typeof workerEmail !== 'string') {
      return NextResponse.json({ error: 'workerEmail is required' }, { status: 400 });
    }
    if (!flagType || !VALID_FLAG_TYPES.includes(flagType)) {
      return NextResponse.json({ error: `flagType must be one of: ${VALID_FLAG_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const flag = await prisma.workerFlag.create({
      data: {
        workerEmail: workerEmail.trim(),
        workerName: workerName?.trim() ?? null,
        flagType,
        severity,
        status: 'OPEN',
        reason: reason.trim(),
        notes: notes?.trim() ?? null,
        createdById: user.id,
        createdByEmail: profile.email,
      },
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (err) {
    console.error('[workforce-monitoring/flags] POST failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
