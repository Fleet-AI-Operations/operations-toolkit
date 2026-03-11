import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@repo/auth/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';

// ============================================================================
// VERCEL CONFIGURATION - Increase timeout for large file uploads
// ============================================================================
export const maxDuration = 300; // 5 minutes (Pro plan max)

// ============================================================================
// HIERARCHICAL PERMISSION HELPER (inline for now, TODO: extract to shared package)
// ============================================================================
type UserRole = 'USER' | 'QA' | 'CORE' | 'FLEET' | 'MANAGER' | 'ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  QA: 2,
  CORE: 3,
  FLEET: 4,
  MANAGER: 4, // Same as FLEET (deprecated)
  ADMIN: 5,
};

function hasPermission(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

// ============================================================================
// AUTH HELPER (using hierarchical permissions)
// ============================================================================
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
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  // Use hierarchical permission check: FLEET and above (includes MANAGER and ADMIN)
  if (!hasPermission(profile.role, 'FLEET')) {
    return { error: NextResponse.json({
      error: 'Forbidden - FLEET role or higher required'
    }, { status: 403 }) };
  }

  return { profile, user };
}

// ============================================================================
// CSV PARSER (handles quoted fields with newlines)
// ============================================================================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const chars = text.split('');
  let current = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote - add literal quote and skip next
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row (handle both \n and \r\n)
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip the \n in \r\n
      }
      currentRow.push(current);
      if (currentRow.length > 0 && currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      current = '';
    } else {
      // Regular character (including newlines inside quotes)
      current += char;
    }
  }

  // Don't forget last field/row
  if (current || currentRow.length > 0) {
    currentRow.push(current);
    if (currentRow.some(f => f.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ============================================================================
// FILE SIZE LIMITS
// ============================================================================
const MAX_FILE_SIZE_MB = 200; // Conservative limit for Vercel Pro (300s timeout)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Estimated memory usage multiplier (parsing + processing overhead)
const MEMORY_MULTIPLIER = 3;

// Note: Theoretical max on Vercel Pro is ~250MB before hitting 300s timeout
// Memory limit (3008MB) allows for files up to ~1GB, but timeout is the bottleneck

// ============================================================================
// POST: Import CSV file (optimized for large files)
// ============================================================================
export async function POST(request: NextRequest) {
  const authResult = await requireFleetAuth(request);
  if (authResult.error) return authResult.error;

  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // VALIDATION: Check file size before processing
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        maxSize: `${MAX_FILE_SIZE_MB}MB`
      }, { status: 413 }); // 413 Payload Too Large
    }

    // Estimate memory usage and warn if risky
    const estimatedMemoryMB = (file.size * MEMORY_MULTIPLIER) / 1024 / 1024;
    if (estimatedMemoryMB > 800) {
      console.warn(`[Import] Large file warning: ${(file.size / 1024 / 1024).toFixed(2)}MB file, estimated ${estimatedMemoryMB.toFixed(0)}MB memory usage`);
    }

    console.log(`[Import] Starting import: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Read CSV file
    const text = await file.text();

    // Parse entire CSV (handles multi-line fields correctly)
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Empty CSV file' }, { status: 400 });
    }

    console.log(`[Import] Parsed ${rows.length} rows in ${Date.now() - startTime}ms`);

    // Parse header
    const header = rows[0].map(h => h.trim().toLowerCase());

    const versionIdIdx = header.findIndex(h => h === 'version_id');
    const taskKeyIdx = header.findIndex(h => h === 'task_key');
    const promptIdx = header.findIndex(h => h === 'prompt');
    const versionNoIdx = header.findIndex(h => h === 'version_no');
    const isActiveIdx = header.findIndex(h => h === 'is_active');
    const createdByNameIdx = header.findIndex(h => h === 'created_by_name' || h === 'author_name');
    const createdByEmailIdx = header.findIndex(h => h === 'created_by_email' || h === 'author_email');
    const createdAtIdx = header.findIndex(h => h === 'task_created_at');
    const envKeyIdx = header.findIndex(h => h === 'env_key');
    const taskLifecycleStatusIdx = header.findIndex(h => h === 'task_lifecycle_status');
    const taskModalityIdx = header.findIndex(h => h === 'task_modality');
    const scenarioTitleIdx = header.findIndex(h => h === 'scenario_title');
    const taskComplexityTierIdx = header.findIndex(h => h === 'task_complexity_tier');

    if (versionIdIdx === -1 || promptIdx === -1) {
      return NextResponse.json({
        error: 'CSV must contain "version_id" and "prompt" columns',
        foundColumns: header
      }, { status: 400 });
    }

    // Process in batches (skip header row)
    const BATCH_SIZE = 500; // Insert 500 records at a time
    const HEARTBEAT_INTERVAL = 5000; // Log progress every 5 seconds
    let imported = 0;
    let skipped = 0;
    let skippedFleetEmails = 0;
    let skippedWrongVersion = 0;
    let errors: string[] = [];
    let lastHeartbeat = Date.now();

    for (let i = 1; i < rows.length; i += BATCH_SIZE) {
      // Heartbeat logging to prevent timeout appearance
      if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL) {
        const progress = ((i / rows.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Import] Progress: ${progress}% (${i}/${rows.length} rows, ${elapsed}s elapsed)`);
        lastHeartbeat = Date.now();
      }

      const batch = rows.slice(i, i + BATCH_SIZE);
      const records = [];

      for (const fields of batch) {
        try {
          const versionId = fields[versionIdIdx]?.trim();
          const prompt = fields[promptIdx]?.trim();
          const versionNo = versionNoIdx >= 0 ? parseInt(fields[versionNoIdx]) || null : null;

          if (!versionId || !prompt) {
            skipped++;
            continue;
          }

          // VERSION CHECK DISABLED - Import all versions for now
          // if (versionNo !== 1) {
          //   skipped++;
          //   skippedWrongVersion++;
          //   continue;
          // }

          // Skip records created by @fleet.so email addresses
          const createdByEmail = createdByEmailIdx >= 0 ? fields[createdByEmailIdx]?.trim() : null;
          if (createdByEmail && createdByEmail.toLowerCase().endsWith('@fleet.so')) {
            skipped++;
            skippedFleetEmails++;
            continue;
          }

          records.push({
            versionId,
            taskKey: fields[taskKeyIdx]?.trim() || '',
            prompt,
            versionNo,
            isActive: isActiveIdx >= 0 ? fields[isActiveIdx]?.toLowerCase() === 'true' : null,
            createdByName: createdByNameIdx >= 0 ? fields[createdByNameIdx]?.trim() || null : null,
            createdByEmail,
            createdAt: createdAtIdx >= 0 && fields[createdAtIdx]?.trim() ? new Date(fields[createdAtIdx].trim()) : null,
            envKey: envKeyIdx >= 0 ? fields[envKeyIdx]?.trim() || null : null,
            taskLifecycleStatus: taskLifecycleStatusIdx >= 0 ? fields[taskLifecycleStatusIdx]?.trim() || null : null,
            taskModality: taskModalityIdx >= 0 ? fields[taskModalityIdx]?.trim() || null : null,
            scenarioTitle: scenarioTitleIdx >= 0 ? fields[scenarioTitleIdx]?.trim() || null : null,
            taskComplexityTier: taskComplexityTierIdx >= 0 ? fields[taskComplexityTierIdx]?.trim() || null : null,
            analysisStatus: 'PENDING',
          });
        } catch (error) {
          errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Parse error'}`);
          skipped++;
        }
      }

      if (records.length > 0) {
        try {
          await prisma.promptAuthenticityRecord.createMany({
            data: records,
            skipDuplicates: true,
          });
          imported += records.length;
        } catch (error) {
          console.error(`[Import] Batch insert error (rows ${i}-${i + BATCH_SIZE}):`, error);
          errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${error instanceof Error ? error.message : 'Insert error'}`);
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const recordsPerSecond = (imported / parseFloat(totalTime)).toFixed(0);

    console.log(`[Import] Complete: ${imported} imported, ${skipped} skipped (${skippedFleetEmails} fleet emails, ${skippedWrongVersion} wrong version), ${errors.length} errors in ${totalTime}s (${recordsPerSecond} records/s)`);

    logAudit({
      action: 'PROMPT_AUTHENTICITY_IMPORTED',
      entityType: 'PROMPT_AUTHENTICITY_RECORD',
      userId: authResult.user.id,
      userEmail: authResult.user.email ?? 'unknown',
      metadata: { imported, skipped, skippedFleetEmails, fileName: file.name, fileSizeMB: (file.size / 1024 / 1024).toFixed(2) },
    }).catch(err => console.error('[Prompt Authenticity Import] Audit log failed:', err));

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      skippedFleetEmails,
      skippedWrongVersion,
      errors: errors.slice(0, 100), // Limit error list to first 100
      message: `Imported ${imported} prompts, skipped ${skipped} (${skippedFleetEmails} @fleet.so, ${skippedWrongVersion} wrong version)${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
      performance: {
        totalTimeSeconds: parseFloat(totalTime),
        recordsPerSecond: parseInt(recordsPerSecond),
        fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
      },
      debug: {
        totalRows: rows.length - 1, // Exclude header
        headerColumns: header.length,
        headerSample: header.slice(0, 10),
        indices: {
          versionId: versionIdIdx,
          taskKey: taskKeyIdx,
          prompt: promptIdx,
          versionNo: versionNoIdx,
          createdAt: createdAtIdx,
          createdByName: createdByNameIdx,
          createdByEmail: createdByEmailIdx,
          envKey: envKeyIdx,
        }
      }
    });
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Import] Fatal error after ${totalTime}s:`, error);

    // Handle specific error types
    if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      return NextResponse.json({
        error: 'Import timeout - file too large for serverless processing',
        suggestion: 'Try splitting the file into smaller chunks (< 5000 rows each)',
        details: error.message
      }, { status: 504 }); // 504 Gateway Timeout
    }

    if (error.message?.includes('memory') || error.message?.includes('heap')) {
      return NextResponse.json({
        error: 'Out of memory - file too large to process',
        suggestion: 'Try splitting the file into smaller chunks',
        details: error.message
      }, { status: 507 }); // 507 Insufficient Storage
    }

    return NextResponse.json(
      { error: 'Failed to import CSV', details: error.message },
      { status: 500 },
    );
  }
}
