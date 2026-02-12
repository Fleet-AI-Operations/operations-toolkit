import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { VALID_CATEGORIES } from '@/lib/time-tracking-constants';

// PATCH /api/time-entries/[id] - Update a time entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { date, hours, minutes, category, count, notes } = body;

    // Check if entry exists and belongs to user
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    if (existingEntry.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build update data with validation
    const updateData: Prisma.TimeEntryUpdateInput = {};
    let finalHours = existingEntry.hours;
    let finalMinutes = existingEntry.minutes;

    if (date !== undefined) {
      // Validate YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      // Parse date without timezone ambiguity
      const [year, month, day] = date.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);

      // Verify the date is valid
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date. Please check the day is valid for the month.' },
          { status: 400 }
        );
      }

      updateData.date = parsedDate;
    }

    if (hours !== undefined) {
      const parsedHours = Number(hours);
      if (!Number.isInteger(parsedHours) || parsedHours < 0 || parsedHours > 23) {
        return NextResponse.json(
          { error: 'Hours must be an integer between 0 and 23' },
          { status: 400 }
        );
      }
      updateData.hours = parsedHours;
      finalHours = parsedHours;
    }

    if (minutes !== undefined) {
      const parsedMinutes = Number(minutes);
      if (!Number.isInteger(parsedMinutes) || parsedMinutes < 0 || parsedMinutes > 59) {
        return NextResponse.json(
          { error: 'Minutes must be an integer between 0 and 59' },
          { status: 400 }
        );
      }
      updateData.minutes = parsedMinutes;
      finalMinutes = parsedMinutes;
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: 'Invalid category' },
          { status: 400 }
        );
      }
      updateData.category = category;
    }

    if (count !== undefined) {
      if (count !== null) {
        const parsedCount = Number(count);
        if (!Number.isInteger(parsedCount) || parsedCount < 0) {
          return NextResponse.json(
            { error: 'Count must be a positive integer' },
            { status: 400 }
          );
        }
        updateData.count = parsedCount;
      } else {
        updateData.count = null;
      }
    }

    if (notes !== undefined) {
      if (notes && notes.length > 2000) {
        return NextResponse.json(
          { error: 'Notes must be 2000 characters or less' },
          { status: 400 }
        );
      }
      updateData.notes = notes || null;
    }

    // Validate that final time is not 0h 0m
    if (finalHours === 0 && finalMinutes === 0) {
      return NextResponse.json(
        { error: 'Time cannot be 0h 0m. Please enter at least 1 minute.' },
        { status: 400 }
      );
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error updating time entry:', error);
    return NextResponse.json(
      { error: 'Failed to update time entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/time-entries/[id] - Delete a time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if entry exists and belongs to user
    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    if (existingEntry.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.timeEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete time entry' },
      { status: 500 }
    );
  }
}
