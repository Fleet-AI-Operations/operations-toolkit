/**
 * GET /api/audit-logs - Fetch audit logs with pagination and filters
 * Access: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminRole();
  if ('error' in authResult) return authResult.error;

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') || '50', 10)));
    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const environment = searchParams.get('environment') || undefined;
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

    if (environment) {
      where.environment = environment;
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
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
