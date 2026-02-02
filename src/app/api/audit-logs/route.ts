/**
 * GET /api/audit-logs - Fetch audit logs with pagination and filters
 * Access: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ERROR_IDS } from '@/constants/errorIds';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') || '50', 10)));
    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filter conditions
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (startDate || endDate) {
      where.createdAt = {};

      let startDateTime: Date | undefined;
      let endDateTime: Date | undefined;

      if (startDate) {
        const date = new Date(startDate);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid startDate format. Expected ISO 8601 date string.' },
            { status: 400 }
          );
        }
        startDateTime = date;
        where.createdAt.gte = date;
      }

      if (endDate) {
        const date = new Date(endDate);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid endDate format. Expected ISO 8601 date string.' },
            { status: 400 }
          );
        }
        endDateTime = date;
        where.createdAt.lte = date;
      }

      // Validate that endDate is after startDate
      if (startDateTime && endDateTime && endDateTime < startDateTime) {
        return NextResponse.json(
          { error: 'endDate must be after startDate' },
          { status: 400 }
        );
      }
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', {
      errorId: ERROR_IDS.AUDIT_LOGS_FETCH_FAILED,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', errorId: ERROR_IDS.AUDIT_LOGS_FETCH_FAILED },
      { status: 500 }
    );
  }
}
