import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@repo/database';
import { requireRole } from '@repo/api-utils';

interface WorkerMetrics {
  workerName: string;
  workerEmail: string;
  totalTasks: number;
  totalHours: number;
  avgHoursPerTask: number;
  daysActive: number;
  tasksPerDay: number;
  experienceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flagStatus: 'NORMAL' | 'FAST' | 'SLOW' | 'INCONSISTENT';
  flagReason: string | null;
  firstReportDate: Date;
  lastReportDate: Date;
}

interface AggregatedRow {
  worker_email: string;
  worker_name: string;
  total_hours: string;
  report_count: bigint;
  days_active: bigint;
  first_date: Date;
  last_date: Date;
  all_notes: string[];
}

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['FLEET', 'MANAGER', 'ADMIN']);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const experienceLevel = searchParams.get('experienceLevel');
    const flagStatus = searchParams.get('flagStatus');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate date params before use
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: 'Invalid startDate format' }, { status: 400 });
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: 'Invalid endDate format' }, { status: 400 });
    }

    // Build date filter using Prisma.sql tagged templates — preferred over $queryRawUnsafe;
    // parameters are automatically parameterized, eliminating manual index bookkeeping.
    const conditions: Prisma.Sql[] = [];
    if (startDate) conditions.push(Prisma.sql`work_date >= ${new Date(startDate)}`);
    if (endDate) conditions.push(Prisma.sql`work_date <= ${new Date(endDate)}`);
    const where = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    // Use database-level aggregation for performance (takes advantage of indexes)
    const aggregatedData = await prisma.$queryRaw<AggregatedRow[]>`
      SELECT
        worker_email,
        worker_name,
        SUM(hours_worked::numeric) as total_hours,
        COUNT(*) as report_count,
        COUNT(DISTINCT work_date) as days_active,
        MIN(work_date) as first_date,
        MAX(work_date) as last_date,
        ARRAY_AGG(notes ORDER BY work_date) as all_notes
      FROM time_report_records
      ${where}
      GROUP BY worker_email, worker_name
      ORDER BY worker_email
    `;

    // Calculate metrics for each worker (with task counting from notes)
    const workerMetrics: WorkerMetrics[] = [];
    for (const row of aggregatedData) {
      // Count tasks from all notes
      let totalTasks = 0;
      const notes = row.all_notes || [];
      for (const note of notes) {
        if (!note) continue;
        const activities = note.split(/[\n|]/).filter((line: string) => line.trim().length > 10);
        totalTasks += activities.length || 1;
      }

      const totalHours = parseFloat(row.total_hours) || 0;
      const daysActive = parseInt(String(row.days_active)) || 0;
      const avgHoursPerTask = totalTasks > 0 ? totalHours / totalTasks : 0;
      const tasksPerDay = daysActive > 0 ? totalTasks / daysActive : 0;

      // Determine experience level
      let experienceLevelValue: 'LOW' | 'MEDIUM' | 'HIGH';
      if (totalTasks < 50) {
        experienceLevelValue = 'LOW';
      } else if (totalTasks < 200) {
        experienceLevelValue = 'MEDIUM';
      } else {
        experienceLevelValue = 'HIGH';
      }

      workerMetrics.push({
        workerName: row.worker_name,
        workerEmail: row.worker_email,
        totalTasks,
        totalHours,
        avgHoursPerTask,
        daysActive,
        tasksPerDay,
        experienceLevel: experienceLevelValue,
        flagStatus: 'NORMAL', // Will calculate below
        flagReason: null,
        firstReportDate: new Date(row.first_date),
        lastReportDate: new Date(row.last_date),
      });
    }

    // Calculate team averages for flagging
    const totalWorkers = workerMetrics.length;
    if (totalWorkers === 0) {
      return NextResponse.json({
        workers: [],
        summary: {
          totalWorkers: 0,
          teamAvgAHT: 0,
          flaggedWorkers: 0,
          lowExperience: 0,
          mediumExperience: 0,
          highExperience: 0,
        },
      });
    }

    const teamAvgAHT = workerMetrics.reduce((sum, w) => sum + w.avgHoursPerTask, 0) / totalWorkers;
    const teamAvgTasksPerDay = workerMetrics.reduce((sum, w) => sum + w.tasksPerDay, 0) / totalWorkers;

    // Flag workers based on AHT anomalies
    for (const worker of workerMetrics) {
      if (worker.avgHoursPerTask > teamAvgAHT * 1.5) {
        worker.flagStatus = 'SLOW';
        worker.flagReason = `AHT ${worker.avgHoursPerTask.toFixed(2)}h is ${((worker.avgHoursPerTask / teamAvgAHT - 1) * 100).toFixed(0)}% above team average`;
      } else if (worker.avgHoursPerTask < teamAvgAHT * 0.5 && worker.avgHoursPerTask > 0) {
        worker.flagStatus = 'FAST';
        worker.flagReason = `AHT ${worker.avgHoursPerTask.toFixed(2)}h is ${((1 - worker.avgHoursPerTask / teamAvgAHT) * 100).toFixed(0)}% below team average`;
      } else if (worker.tasksPerDay < teamAvgTasksPerDay * 0.3 && worker.experienceLevel === 'HIGH') {
        worker.flagStatus = 'INCONSISTENT';
        worker.flagReason = `High experience but low productivity: ${worker.tasksPerDay.toFixed(1)} tasks/day vs team avg ${teamAvgTasksPerDay.toFixed(1)}`;
      }
    }

    // Apply filters
    let filteredWorkers = workerMetrics;

    if (experienceLevel && experienceLevel !== 'all') {
      filteredWorkers = filteredWorkers.filter(w => w.experienceLevel === experienceLevel);
    }

    if (flagStatus && flagStatus !== 'all') {
      filteredWorkers = filteredWorkers.filter(w => w.flagStatus === flagStatus);
    }

    // Calculate summary stats (before pagination)
    const summary = {
      totalWorkers: workerMetrics.length,
      teamAvgAHT,
      teamAvgTasksPerDay,
      flaggedWorkers: workerMetrics.filter(w => w.flagStatus !== 'NORMAL').length,
      lowExperience: workerMetrics.filter(w => w.experienceLevel === 'LOW').length,
      mediumExperience: workerMetrics.filter(w => w.experienceLevel === 'MEDIUM').length,
      highExperience: workerMetrics.filter(w => w.experienceLevel === 'HIGH').length,
      slowWorkers: workerMetrics.filter(w => w.flagStatus === 'SLOW').length,
      fastWorkers: workerMetrics.filter(w => w.flagStatus === 'FAST').length,
      inconsistentWorkers: workerMetrics.filter(w => w.flagStatus === 'INCONSISTENT').length,
    };

    // Apply pagination
    const totalFiltered = filteredWorkers.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const offset = (page - 1) * limit;
    const paginatedWorkers = filteredWorkers.slice(offset, offset + limit);

    return NextResponse.json({
      workers: paginatedWorkers,
      summary,
      pagination: {
        page,
        limit,
        totalPages,
        totalRecords: totalFiltered,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error in screening analysis:', error);
    return NextResponse.json(
      { error: 'Failed to perform screening analysis' },
      { status: 500 },
    );
  }
}
