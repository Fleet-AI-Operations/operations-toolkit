/**
 * Timesheet Submission Service
 *
 * Background process to submit time entries to Deel as timesheets.
 * Requires time entries to have contract_id populated (from contract sync).
 */

import type { PrismaClient } from '@prisma/client';
import type { DeelAPIConfig } from './client';

export interface DeelTimesheetData {
  quantity: number;
  contract_id: string;
  description: string;
  date_submitted: string; // YYYY-MM-DD
  is_auto_approved?: boolean;
  hourly_report_preset_id?: string;
}

export interface DeelTimesheetResponse {
  data: {
    id: string;
    status: 'pending' | 'approved' | 'declined' | 'not_payable' | 'paid' | 'processing';
    created: boolean;
    created_at: string;
  };
}

export interface TimesheetSubmitResult {
  success: boolean;
  totalEntries: number;
  entriesSubmitted: number;
  entriesFailed: number;
  entriesSkipped: number;
  errors: Array<{
    entryId: string;
    error: string;
  }>;
}

export interface TimesheetSubmitOptions {
  /**
   * Only submit entries with this status (default: 'pending')
   */
  entryStatus?: string;

  /**
   * Auto-approve timesheets on submission
   */
  autoApprove?: boolean;

  /**
   * Batch size for submission (default: 10)
   * Process this many entries at a time to avoid overwhelming the API
   */
  batchSize?: number;

  /**
   * Delay between batches in milliseconds (default: 1000)
   */
  batchDelay?: number;
}

/**
 * Convert hours and minutes to decimal quantity
 * Example: 8 hours 30 minutes = 8.5
 */
function convertToDecimalHours(hours: number, minutes: number): number {
  return hours + (minutes / 60);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateForDeel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Submit a single timesheet to Deel API
 */
async function submitTimesheet(
  config: DeelAPIConfig,
  data: DeelTimesheetData
): Promise<DeelTimesheetResponse> {
  const url = `${config.baseUrl}/rest/v2/timesheets`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Deel API error (${response.status}): ${errorText}`
    );
  }

  return await response.json() as DeelTimesheetResponse;
}

/**
 * Submit time entries to Deel as timesheets
 */
export async function submitTimesheets(
  prisma: PrismaClient,
  config: DeelAPIConfig,
  options: TimesheetSubmitOptions = {}
): Promise<TimesheetSubmitResult> {
  const result: TimesheetSubmitResult = {
    success: false,
    totalEntries: 0,
    entriesSubmitted: 0,
    entriesFailed: 0,
    entriesSkipped: 0,
    errors: [],
  };

  const batchSize = options.batchSize || 10;
  const batchDelay = options.batchDelay || 1000;

  try {
    // Step 1: Fetch time entries ready for submission
    // Must have: contract_id (from contract sync)
    // Must be: specified status (default 'pending')
    // Must NOT have: deel_timesheet_id (not already submitted)
    const whereClause: any = {
      contractId: { not: null },
      deelTimesheetId: null,
    };

    if (options.entryStatus) {
      whereClause.status = options.entryStatus;
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    result.totalEntries = timeEntries.length;
    console.log(`Found ${timeEntries.length} time entries ready for submission`);

    if (timeEntries.length === 0) {
      result.success = true;
      return result;
    }

    // Step 2: Process entries in batches
    for (let i = 0; i < timeEntries.length; i += batchSize) {
      const batch = timeEntries.slice(i, i + batchSize);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(timeEntries.length / batchSize)}`);

      for (const entry of batch) {
        try {
          // Validate entry has contract_id
          if (!entry.contractId) {
            result.entriesSkipped++;
            console.log(`Skipping entry ${entry.id}: no contract_id`);
            continue;
          }

          // Mark as processing
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: { status: 'processing' },
          });

          // Convert time to decimal hours
          const quantity = convertToDecimalHours(entry.hours, entry.minutes);

          // Build description from category and notes
          let description = entry.category;
          if (entry.notes) {
            description += ` - ${entry.notes}`;
          }
          if (entry.count) {
            description += ` (Count: ${entry.count})`;
          }

          // Submit to Deel API
          const timesheetData: DeelTimesheetData = {
            quantity,
            contract_id: entry.contractId,
            description,
            date_submitted: formatDateForDeel(entry.date),
            is_auto_approved: options.autoApprove || false,
          };

          console.log(`Submitting entry ${entry.id}: ${quantity}h on ${timesheetData.date_submitted}`);
          const response = await submitTimesheet(config, timesheetData);

          // Update entry with Deel timesheet ID and mark as sent
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: {
              deelTimesheetId: response.data.id,
              status: 'sent',
            },
          });

          result.entriesSubmitted++;
          console.log(`✓ Successfully submitted entry ${entry.id}, timesheet ID: ${response.data.id}`);

        } catch (error) {
          result.entriesFailed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`✗ Failed to submit entry ${entry.id}:`, errorMsg);

          result.errors.push({
            entryId: entry.id,
            error: errorMsg,
          });

          // Mark entry as failed
          try {
            await prisma.timeEntry.update({
              where: { id: entry.id },
              data: { status: 'failed' },
            });
          } catch (updateError) {
            console.error(`Failed to update entry ${entry.id} status to failed:`, updateError);
          }
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + batchSize < timeEntries.length) {
        console.log(`Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    result.success = result.entriesFailed === 0;
    console.log(
      `Submission complete: ${result.entriesSubmitted} submitted, ${result.entriesFailed} failed, ${result.entriesSkipped} skipped`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Timesheet submission failed:', errorMsg);
    result.errors.push({
      entryId: 'N/A',
      error: `Submission failed: ${errorMsg}`,
    });
    return result;
  }
}

/**
 * Get summary of time entries by submission status
 */
export async function getTimesheetSubmitStats(
  prisma: PrismaClient
): Promise<{
  total: number;
  readyToSubmit: number;
  needsContractId: number;
  submitted: number;
  byStatus: Record<string, number>;
}> {
  const [total, readyToSubmit, needsContractId, submitted, byStatusRaw] = await Promise.all([
    prisma.timeEntry.count(),
    prisma.timeEntry.count({
      where: {
        contractId: { not: null },
        deelTimesheetId: null,
        status: 'pending',
      },
    }),
    prisma.timeEntry.count({
      where: {
        contractId: null,
      },
    }),
    prisma.timeEntry.count({
      where: {
        deelTimesheetId: { not: null },
      },
    }),
    prisma.timeEntry.groupBy({
      by: ['status'],
      _count: true,
    }),
  ]);

  // Build byStatus map
  const byStatus: Record<string, number> = {};
  for (const group of byStatusRaw) {
    byStatus[group.status] = group._count;
  }

  return {
    total,
    readyToSubmit,
    needsContractId,
    submitted,
    byStatus,
  };
}
