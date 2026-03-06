import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';

// ============================================================================
// VERCEL CONFIGURATION
// ============================================================================
export const maxDuration = 300;

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
// BUILD WHERE CLAUSE (shared between GET and POST)
// ============================================================================
function buildWhere(params: {
  environment?: string | null;
  recordType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userSearch?: string | null;
}) {
  const where: any = {};

  if (params.environment) {
    where.environment = params.environment;
  }

  if (params.recordType && params.recordType !== 'ALL') {
    where.type = params.recordType;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      const d = new Date(params.startDate);
      if (!isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (params.endDate) {
      const d = new Date(params.endDate);
      if (!isNaN(d.getTime())) where.createdAt.lte = d;
    }
  }

  if (params.userSearch) {
    where.OR = [
      { createdByEmail: { contains: params.userSearch, mode: 'insensitive' } },
      { createdByName: { contains: params.userSearch, mode: 'insensitive' } },
    ];
  }

  // Skip records created by @fleet.so email addresses (same as CSV import)
  const notClause = { createdByEmail: { endsWith: '@fleet.so' } };
  where.NOT = params.userSearch
    ? [notClause]
    : notClause;

  return where;
}

// ============================================================================
// GET: Preview count of matching DataRecords
// ============================================================================
export async function GET(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    const recordType = searchParams.get('recordType') || 'TASK';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userSearch = searchParams.get('userSearch');

    const where = buildWhere({ environment, recordType, startDate, endDate, userSearch });

    const total = await prisma.dataRecord.count({ where });

    // Count how many are already in the authenticity table
    const existingIds = await prisma.promptAuthenticityRecord.findMany({
      select: { versionId: true },
    });
    const existingSet = new Set(existingIds.map((r) => r.versionId));

    // We can't do a DB-level anti-join easily here, so just return total and let
    // the POST handle skipDuplicates. Provide an estimate.
    return NextResponse.json({ total, alreadySynced: existingSet.size });
  } catch (error: any) {
    console.error('Preview count error:', error);
    return NextResponse.json({ error: 'Failed to get count', details: error.message }, { status: 500 });
  }
}

// ============================================================================
// POST: Sync DataRecords into PromptAuthenticityRecord
// ============================================================================
export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const {
      environment,
      recordType = 'TASK',
      startDate,
      endDate,
      limit,
      userSearch,
    } = body;

    const where = buildWhere({ environment, recordType, startDate, endDate, userSearch });

    const records = await prisma.dataRecord.findMany({
      where,
      select: {
        id: true,
        content: true,
        environment: true,
        type: true,
        createdAt: true,
        createdByName: true,
        createdByEmail: true,
      },
      ...(limit && limit > 0 ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'No matching records found' }, { status: 400 });
    }

    // Upsert in batches of 500
    const BATCH_SIZE = 500;
    let synced = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const data = batch.map((r) => ({
        versionId: r.id,
        taskKey: r.id,
        prompt: r.content,
        envKey: r.environment,
        createdByName: r.createdByName ?? null,
        createdByEmail: r.createdByEmail ?? null,
        createdAt: r.createdAt,
        analysisStatus: 'PENDING',
      }));

      const result = await prisma.promptAuthenticityRecord.createMany({
        data,
        skipDuplicates: true,
      });

      synced += result.count;
    }

    const skipped = records.length - synced;

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      total: records.length,
      message: `Synced ${synced} records to the analysis queue${skipped > 0 ? ` (${skipped} already existed)` : ''}.`,
    });
  } catch (error: any) {
    console.error('Sync from records error:', error);
    return NextResponse.json({ error: 'Failed to sync records', details: error.message }, { status: 500 });
  }
}
