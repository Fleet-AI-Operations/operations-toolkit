import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

/**
 * PATCH /api/workforce-monitoring/flags/[id]
 *
 * Updates a worker flag's status and/or resolution details.
 * Requires FLEET or higher role.
 *
 * Body: { status, resolutionNotes? }
 *
 * Returns:
 *   200 { flag }
 *   400 validation error
 *   401 Unauthorized
 *   403 Forbidden
 *   404 flag not found
 *   500 Internal server error
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const existing = await prisma.workerFlag.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { status, resolutionNotes, notes } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const isResolved = status === 'RESOLVED' || status === 'DISMISSED';

    const flag = await prisma.workerFlag.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() ?? null } : {}),
        ...(resolutionNotes !== undefined ? { resolutionNotes: resolutionNotes?.trim() ?? null } : {}),
        ...(isResolved ? { resolvedById: user.id, resolvedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ flag });
  } catch (err) {
    console.error('[workforce-monitoring/flags/[id]] PATCH failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
