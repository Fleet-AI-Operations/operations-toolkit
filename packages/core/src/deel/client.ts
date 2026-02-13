/**
 * Deel API Client
 *
 * Client for interacting with the Deel API (https://api.letsdeel.com)
 * Reference: https://developer.deel.com/api/endpoints/contracts/get-contracts
 */

export interface DeelWorker {
  id: string;
  email: string | null;
  full_name: string;
  image?: string | null;
  alternate_email?: Array<{
    email: string | null;
    isVerified: boolean;
  }>;
}

export interface DeelContract {
  id: string; // UUID of the contract
  type: string;
  title: string;
  status: string;
  worker: DeelWorker | null;
  created_at: string | null;
  is_archived: boolean;
  is_shielded: boolean;
  external_id?: string | null;
}

export interface DeelContractsResponse {
  data: DeelContract[];
  page: {
    cursor: string;
    total_rows: number;
  };
}

export interface DeelAPIConfig {
  baseUrl: string;
  apiToken: string;
}

/**
 * Fetch all contracts from Deel API with pagination support
 */
export async function fetchDeelContracts(
  config: DeelAPIConfig,
  options?: {
    limit?: number;
    statuses?: string[];
    search?: string;
  }
): Promise<DeelContract[]> {
  const allContracts: DeelContract[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${config.baseUrl}/rest/v2/contracts`);

    // Add query parameters
    if (options?.limit) {
      url.searchParams.set('limit', options.limit.toString());
    }
    if (cursor) {
      url.searchParams.set('after_cursor', cursor);
    }
    if (options?.statuses && options.statuses.length > 0) {
      url.searchParams.set('statuses', JSON.stringify(options.statuses));
    }
    if (options?.search) {
      url.searchParams.set('search', options.search);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Deel API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json() as DeelContractsResponse;
    allContracts.push(...data.data);

    // Check if there are more pages
    cursor = data.page.cursor;
    hasMore = data.data.length > 0 && cursor !== null && cursor !== '';
  }

  return allContracts;
}

/**
 * Find contract for a specific user by email
 * Checks both primary email and alternate emails
 */
export function findContractByEmail(
  contracts: DeelContract[],
  email: string
): DeelContract | null {
  const normalizedEmail = email.toLowerCase().trim();

  for (const contract of contracts) {
    if (!contract.worker) continue;

    // Check primary email
    if (contract.worker.email?.toLowerCase().trim() === normalizedEmail) {
      return contract;
    }

    // Check alternate emails
    if (contract.worker.alternate_email) {
      for (const altEmail of contract.worker.alternate_email) {
        if (altEmail.email?.toLowerCase().trim() === normalizedEmail) {
          return contract;
        }
      }
    }
  }

  return null;
}

/**
 * Build a map of email -> contract ID for efficient lookups
 * Includes both primary and alternate emails
 */
export function buildEmailToContractMap(
  contracts: DeelContract[]
): Map<string, string> {
  const emailMap = new Map<string, string>();

  for (const contract of contracts) {
    if (!contract.worker) continue;

    // Add primary email
    if (contract.worker.email) {
      const normalizedEmail = contract.worker.email.toLowerCase().trim();
      emailMap.set(normalizedEmail, contract.id);
    }

    // Add alternate emails
    if (contract.worker.alternate_email) {
      for (const altEmail of contract.worker.alternate_email) {
        if (altEmail.email) {
          const normalizedEmail = altEmail.email.toLowerCase().trim();
          emailMap.set(normalizedEmail, contract.id);
        }
      }
    }
  }

  return emailMap;
}
