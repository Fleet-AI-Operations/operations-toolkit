/**
 * Contract Sync Service
 *
 * Background process to sync Deel contracts with time entries.
 * This correlates users to their Deel contract IDs by matching email addresses.
 */

import { fetchDeelContracts, buildEmailToContractMap, type DeelAPIConfig } from './client';
import type { PrismaClient } from '@prisma/client';

export interface ContractSyncResult {
  success: boolean;
  totalContracts: number;
  totalTimeEntries: number;
  entriesUpdated: number;
  entriesWithoutContract: number;
  errors: string[];
}

export interface ContractSyncOptions {
  /**
   * Only sync time entries with this status (default: 'pending')
   */
  entryStatus?: string;

  /**
   * Deel contract statuses to filter (e.g., ['in_progress', 'onboarded'])
   * If not specified, fetches all contracts
   */
  contractStatuses?: string[];

  /**
   * Whether to update entries that already have a contract_id
   * Default: false (only update entries without contract_id)
   */
  overwriteExisting?: boolean;
}

/**
 * Sync contracts from Deel API and update time entries with contract IDs
 */
export async function syncContracts(
  prisma: PrismaClient,
  config: DeelAPIConfig,
  options: ContractSyncOptions = {}
): Promise<ContractSyncResult> {
  const result: ContractSyncResult = {
    success: false,
    totalContracts: 0,
    totalTimeEntries: 0,
    entriesUpdated: 0,
    entriesWithoutContract: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch all contracts from Deel API
    console.log('Fetching contracts from Deel API...');
    const contracts = await fetchDeelContracts(config, {
      statuses: options.contractStatuses,
    });
    result.totalContracts = contracts.length;
    console.log(`Fetched ${contracts.length} contracts`);

    // Step 2: Build email -> contract ID mapping
    const emailToContractId = buildEmailToContractMap(contracts);
    console.log(`Built mapping for ${emailToContractId.size} email addresses`);

    // Step 3: Fetch time entries that need contract IDs
    const whereClause: any = {};

    if (options.entryStatus) {
      whereClause.status = options.entryStatus;
    }

    if (!options.overwriteExisting) {
      whereClause.contractId = null;
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        user: {
          include: {
            profiles: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });
    result.totalTimeEntries = timeEntries.length;
    console.log(`Found ${timeEntries.length} time entries to process`);

    // Step 4: Update time entries with contract IDs
    for (const entry of timeEntries) {
      try {
        // Determine email to use for lookup
        // Priority: 1. Profile email (if user exists), 2. Entry email field
        let emailForLookup: string | null = null;

        if (entry.user?.profiles) {
          emailForLookup = entry.user.profiles.email;
        } else if (entry.email) {
          emailForLookup = entry.email;
        }

        if (!emailForLookup) {
          result.entriesWithoutContract++;
          continue;
        }

        // Look up contract ID
        const normalizedEmail = emailForLookup.toLowerCase().trim();
        const contractId = emailToContractId.get(normalizedEmail);

        if (contractId) {
          // Update time entry with contract ID
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: { contractId },
          });
          result.entriesUpdated++;
        } else {
          result.entriesWithoutContract++;
          console.log(`No contract found for email: ${emailForLookup}`);
        }
      } catch (error) {
        const errorMsg = `Failed to update entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    console.log(`Sync complete: ${result.entriesUpdated} entries updated, ${result.entriesWithoutContract} without contracts`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Contract sync failed:', errorMsg);
    result.errors.push(`Sync failed: ${errorMsg}`);
    return result;
  }
}

/**
 * Get summary of time entries by contract sync status
 */
export async function getContractSyncStats(
  prisma: PrismaClient
): Promise<{
  total: number;
  withContract: number;
  withoutContract: number;
  byStatus: Record<string, { withContract: number; withoutContract: number }>;
}> {
  const [total, withContract, byStatusRaw] = await Promise.all([
    prisma.timeEntry.count(),
    prisma.timeEntry.count({ where: { contractId: { not: null } } }),
    prisma.timeEntry.groupBy({
      by: ['status'],
      _count: true,
      where: {
        OR: [
          { contractId: { not: null } },
          { contractId: null },
        ],
      },
    }),
  ]);

  // Build byStatus breakdown
  const byStatus: Record<string, { withContract: number; withoutContract: number }> = {};

  for (const group of byStatusRaw) {
    if (!byStatus[group.status]) {
      byStatus[group.status] = { withContract: 0, withoutContract: 0 };
    }
  }

  // Get detailed counts per status
  for (const status of Object.keys(byStatus)) {
    const [withContractCount, withoutContractCount] = await Promise.all([
      prisma.timeEntry.count({
        where: { status, contractId: { not: null } },
      }),
      prisma.timeEntry.count({
        where: { status, contractId: null },
      }),
    ]);
    byStatus[status] = {
      withContract: withContractCount,
      withoutContract: withoutContractCount,
    };
  }

  return {
    total,
    withContract,
    withoutContract: total - withContract,
    byStatus,
  };
}
