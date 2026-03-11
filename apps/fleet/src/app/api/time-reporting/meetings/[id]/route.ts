import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';

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

  if (profileError || !profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { profile, user };
}

// PUT: Update a meeting
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, isRecurring, recurrencePattern, expectedDurationHours, category, isActive } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        isRecurring: isRecurring || false,
        recurrencePattern: isRecurring ? recurrencePattern : null,
        expectedDurationHours: expectedDurationHours || null,
        category: category || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    logAudit({
      action: 'MEETING_UPDATED',
      entityType: 'MEETING',
      entityId: id,
      userId: authResult.user.id,
      userEmail: authResult.user.email ?? 'unknown',
      metadata: { title: meeting.title, category: meeting.category, isActive: meeting.isActive },
    }).catch(err => console.error('[Meetings API] Audit log failed:', err));

    return NextResponse.json({
      success: true,
      meeting,
    });
  } catch (error: any) {
    console.error('Error updating meeting:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update meeting', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a meeting
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    await prisma.meeting.delete({
      where: { id },
    });

    logAudit({
      action: 'MEETING_DELETED',
      entityType: 'MEETING',
      entityId: id,
      userId: authResult.user.id,
      userEmail: authResult.user.email ?? 'unknown',
    }).catch(err => console.error('[Meetings API] Audit log failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting meeting:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete meeting', details: error.message },
      { status: 500 }
    );
  }
}
