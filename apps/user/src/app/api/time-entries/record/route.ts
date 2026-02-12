import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { VALID_CATEGORIES } from '@/lib/time-tracking-constants';

/**
 * POST /api/time-entries/record
 *
 * ⚠️ SECURITY WARNING - TEMPORARY IMPLEMENTATION ⚠️
 *
 * This endpoint is INTENTIONALLY UNAUTHENTICATED for MVP/development purposes only.
 * This poses significant security risks:
 * - Anyone can submit time entries for any email address
 * - No rate limiting (vulnerable to abuse/spam)
 * - No way to verify the requester's identity
 * - Potential for data manipulation
 *
 * TODO - CRITICAL BEFORE PRODUCTION:
 * 1. Implement API token authentication
 * 2. Add rate limiting per IP/token
 * 3. Add request validation and abuse detection
 * 4. Add audit logging for all submissions
 * 5. Consider requiring email verification
 * 6. Add CORS restrictions
 *
 * DO NOT deploy this endpoint to production without addressing these security concerns.
 *
 * ---
 *
 * Public endpoint for browser extension time tracking (no authentication required).
 *
 * Request body:
 * {
 *   email: string,          // User's email address
 *   category: string,       // One of VALID_CATEGORIES
 *   hours: number,          // 0-23
 *   minutes: number,        // 0-59
 *   count?: number,         // Optional task count
 *   notes?: string,         // Optional notes
 *   date?: string           // Optional date (YYYY-MM-DD), defaults to today
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, category, hours, minutes, count, notes, date } = body;

    // Validation: Required fields
    if (!email || !category || hours === undefined || minutes === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: email, category, hours, minutes' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Look up user by email (optional - user may not exist yet)
    const profile = await prisma.profile.findUnique({
      where: { email: email.toLowerCase() },
    });

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
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
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

    // Parse date (default to today if not provided)
    let dateObj: Date;
    if (date) {
      // Validate YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      // Parse date without timezone ambiguity
      const [year, month, day] = date.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);

      // Verify the date is valid (catches invalid dates like 2026-02-30)
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date. Please check the day is valid for the month.' },
          { status: 400 }
        );
      }
    } else {
      // Use current date
      const now = new Date();
      dateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Create time entry
    // If user exists, link to userId; otherwise store email for later linking
    const entry = await prisma.timeEntry.create({
      data: {
        userId: profile ? profile.id : null,
        email: email.toLowerCase(),
        date: dateObj,
        hours: parsedHours,
        minutes: parsedMinutes,
        category,
        count: count !== undefined && count !== null ? Number(count) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        date: entry.date,
        hours: entry.hours,
        minutes: entry.minutes,
        category: entry.category,
        count: entry.count,
        notes: entry.notes,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error recording time entry:', error);
    return NextResponse.json(
      { error: 'Failed to record time entry' },
      { status: 500 }
    );
  }
}
