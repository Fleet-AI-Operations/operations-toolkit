import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { VALID_CATEGORIES } from '@/lib/time-tracking-constants';

// GET /api/time-entries - List time entries for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    // Build where clause
    const where: Prisma.TimeEntryWhereInput = {
      userId: user.id,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const [year, month, day] = startDate.split('-').map(Number);
        where.date.gte = new Date(year, month - 1, day);
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-').map(Number);
        where.date.lte = new Date(year, month - 1, day);
      }
    }

    if (category) {
      where.category = category;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

// POST /api/time-entries - Create a new time entry
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, hours, minutes, category, count, notes } = body;

    // Validation
    if (!date || hours === undefined || minutes === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: date, hours, minutes, category' },
        { status: 400 }
      );
    }

    // Parse and validate numeric types
    const parsedHours = Number(hours);
    const parsedMinutes = Number(minutes);

    if (!Number.isInteger(parsedHours) || parsedHours < 0 || parsedHours > 23) {
      return NextResponse.json(
        { error: 'Hours must be an integer between 0 and 23' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(parsedMinutes) || parsedMinutes < 0 || parsedMinutes > 59) {
      return NextResponse.json(
        { error: 'Minutes must be an integer between 0 and 59' },
        { status: 400 }
      );
    }

    if (parsedHours === 0 && parsedMinutes === 0) {
      return NextResponse.json(
        { error: 'Time cannot be 0h 0m. Please enter at least 1 minute.' },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Validate count
    if (count !== undefined && count !== null) {
      const parsedCount = Number(count);
      if (!Number.isInteger(parsedCount) || parsedCount < 0) {
        return NextResponse.json(
          { error: 'Count must be a positive integer' },
          { status: 400 }
        );
      }
    }

    // Validate notes length
    if (notes && notes.length > 2000) {
      return NextResponse.json(
        { error: 'Notes must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Parse date without timezone ambiguity
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    // Verify the date is valid
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date. Please check the day is valid for the month.' },
        { status: 400 }
      );
    }

    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        date: dateObj,
        hours: parsedHours,
        minutes: parsedMinutes,
        category,
        count: count !== undefined && count !== null ? Number(count) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return NextResponse.json(
      { error: 'Failed to create time entry' },
      { status: 500 }
    );
  }
}
