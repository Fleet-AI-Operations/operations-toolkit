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
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['FLEET', 'MANAGER', 'ADMIN'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { profile, user };
}

// GET: Fetch all meetings
export async function GET(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: [
        { isActive: 'desc' },
        { title: 'asc' }
      ],
    });

    return NextResponse.json({
      meetings,
    });
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new meeting
export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { title, description, isRecurring, recurrencePattern, expectedDurationHours, category, isActive } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        isRecurring: isRecurring || false,
        recurrencePattern: isRecurring ? recurrencePattern : null,
        expectedDurationHours: expectedDurationHours || null,
        category: category || null,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: authResult.user.email || 'system',
      },
    });

    logAudit({
      action: 'MEETING_CREATED',
      entityType: 'MEETING',
      entityId: meeting.id,
      userId: authResult.user.id,
      userEmail: authResult.user.email ?? 'unknown',
      metadata: { title: meeting.title, category: meeting.category, isRecurring: meeting.isRecurring },
    }).catch(err => console.error('[Meetings API] Audit log failed:', err));

    return NextResponse.json({
      success: true,
      meeting,
    });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting', details: error.message },
      { status: 500 }
    );
  }
}
