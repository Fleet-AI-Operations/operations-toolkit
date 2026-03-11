import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';

async function requireAdminAuth(request: NextRequest) {
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

  // Only ADMIN can clear tables (more restrictive than Fleet)
  if (profileError || !profile || profile.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 }) };
  }

  return { profile, user };
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { confirmText } = body;

    // Require confirmation text to prevent accidental deletion
    if (confirmText !== 'DELETE ALL DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation text. Must be exactly: DELETE ALL DATA' },
        { status: 400 }
      );
    }

    // Get counts before deletion
    const recordCount = await prisma.promptAuthenticityRecord.count();
    const jobCount = await prisma.promptAuthenticityJob.count();

    // Delete all records and jobs
    await prisma.$transaction([
      prisma.promptAuthenticityRecord.deleteMany({}),
      prisma.promptAuthenticityJob.deleteMany({}),
    ]);

    logAudit({
      action: 'PROMPT_AUTHENTICITY_CLEARED',
      entityType: 'PROMPT_AUTHENTICITY_RECORD',
      userId: authResult.user.id,
      userEmail: authResult.user.email ?? 'unknown',
      metadata: { recordsDeleted: recordCount, jobsDeleted: jobCount },
    }).catch(err => console.error('[Prompt Authenticity Clear] Audit log failed:', err));

    return NextResponse.json({
      success: true,
      message: `Deleted ${recordCount} prompts and ${jobCount} jobs`,
      recordsDeleted: recordCount,
      jobsDeleted: jobCount,
    });
  } catch (error: any) {
    console.error('Clear table error:', error);
    return NextResponse.json(
      { error: 'Failed to clear tables', details: error.message },
      { status: 500 },
    );
  }
}

// GET: Get current table stats
export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const [recordCount, jobCount, pendingCount, completedCount] = await Promise.all([
      prisma.promptAuthenticityRecord.count(),
      prisma.promptAuthenticityJob.count(),
      prisma.promptAuthenticityRecord.count({ where: { analysisStatus: 'PENDING' } }),
      prisma.promptAuthenticityRecord.count({ where: { analysisStatus: 'COMPLETED' } }),
    ]);

    return NextResponse.json({
      totalRecords: recordCount,
      totalJobs: jobCount,
      pendingRecords: pendingCount,
      completedRecords: completedCount,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: error.message },
      { status: 500 },
    );
  }
}
