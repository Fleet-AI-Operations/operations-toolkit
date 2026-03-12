import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { parse } from 'csv-parse/sync';
import { requireRole } from '@repo/api-utils';

export const dynamic = 'force-dynamic';

interface CSVRow {
  id: string;
  created_at: string;
  updated_at: string;
  feedback_id: string;
  eval_task_id: string;
  dispute_status: string;
  dispute_reason: string;
  resolution_reason: string;
  resolved_at: string;
  report_text: string;
  is_helpful: string;
  disputer_user_id: string;
  disputer_name: string;
  disputer_email: string;
  resolver_user_id: string;
  resolver_name: string;
  team_id: string;
  team_name: string;
  task_key: string;
  task_lifecycle_status: string;
  env_key: string;
  env_data_key: string;
  task_modality: string;
  dispute_data: string;
  leased_by: string;
  lease_expires_at: string;
}

interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  matched: number;
  errors: string[];
}

export async function POST(req: NextRequest) {
  const authResult = await requireRole(req, ['ADMIN']);
  if (authResult.error) return authResult.error;
  const { user } = authResult;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    const fileContent = await file.text();

    let records: CSVRow[];
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Failed to parse CSV file: ' + (parseError instanceof Error ? parseError.message : String(parseError)) },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, matched: 0, errors: [] };

    // Pre-fetch data_records by task_key (stored in metadata JSON) to determine matches
    const taskKeys = [...new Set(records.map(r => r.task_key).filter(Boolean))];
    const matchedRecords = await prisma.$queryRaw<{ id: string; task_key: string }[]>`
      SELECT id, metadata->>'task_key' AS task_key
      FROM data_records
      WHERE type = 'TASK'
        AND metadata->>'task_key' = ANY(${taskKeys}::text[])
    `;
    const taskKeyToRecordId = new Map(matchedRecords.map(r => [r.task_key, r.id]));

    // Pre-fetch existing externalIds to distinguish creates from updates
    const allExternalIds = records
      .map(r => parseInt(r.id, 10))
      .filter(n => !isNaN(n));
    const existingDisputes = await prisma.taskDispute.findMany({
      where: { externalId: { in: allExternalIds } },
      select: { externalId: true },
    });
    const existingExternalIds = new Set(existingDisputes.map(d => d.externalId));

    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const rowNum = i + batch.indexOf(row) + 2;
        try {
          const externalId = parseInt(row.id, 10);
          if (isNaN(externalId)) {
            summary.errors.push(`Row ${rowNum}: invalid id "${row.id}"`);
            summary.skipped++;
            continue;
          }

          if (!row.task_key) {
            summary.errors.push(`Row ${rowNum}: missing task_key`);
            summary.skipped++;
            continue;
          }

          const createdAtSource = new Date(row.created_at);
          const updatedAtSource = new Date(row.updated_at);
          if (isNaN(createdAtSource.getTime()) || isNaN(updatedAtSource.getTime())) {
            summary.errors.push(`Row ${rowNum}: invalid date in created_at or updated_at`);
            summary.skipped++;
            continue;
          }

          const feedbackId = parseInt(row.feedback_id, 10);
          if (isNaN(feedbackId)) {
            summary.errors.push(`Row ${rowNum}: invalid feedback_id "${row.feedback_id}"`);
            summary.skipped++;
            continue;
          }

          const evalTaskId = row.task_key ? (taskKeyToRecordId.get(row.task_key) ?? null) : null;

          const resolvedAt = row.resolved_at ? new Date(row.resolved_at) : null;
          const leaseExpiresAt = row.lease_expires_at ? new Date(row.lease_expires_at) : null;

          let isHelpful: boolean | null = null;
          if (row.is_helpful === 'True') isHelpful = true;
          else if (row.is_helpful === 'False') isHelpful = false;

          let disputeData: object | null = null;
          if (row.dispute_data) {
            try { disputeData = JSON.parse(row.dispute_data); } catch { /* leave null */ }
          }

          const data = {
            externalId,
            createdAtSource,
            updatedAtSource,
            feedbackId,
            evalTaskId,
            disputeStatus: row.dispute_status || 'pending',
            disputeReason: row.dispute_reason || null,
            resolutionReason: row.resolution_reason || null,
            resolvedAt: resolvedAt && !isNaN(resolvedAt.getTime()) ? resolvedAt : null,
            reportText: row.report_text || null,
            isHelpful,
            disputerUserId: row.disputer_user_id || null,
            disputerName: row.disputer_name || null,
            disputerEmail: row.disputer_email || null,
            resolverUserId: row.resolver_user_id || null,
            resolverName: row.resolver_name || null,
            teamId: row.team_id || null,
            teamName: row.team_name || null,
            taskKey: row.task_key,
            taskLifecycleStatus: row.task_lifecycle_status || null,
            envKey: row.env_key || null,
            envDataKey: row.env_data_key || null,
            taskModality: row.task_modality || null,
            disputeData: disputeData ?? undefined,
            leasedBy: row.leased_by || null,
            leaseExpiresAt: leaseExpiresAt && !isNaN(leaseExpiresAt.getTime()) ? leaseExpiresAt : null,
          };

          const isNew = !existingExternalIds.has(externalId);
          await prisma.taskDispute.upsert({
            where: { externalId },
            create: data,
            update: data,
          });
          if (isNew) {
            summary.imported++;
            if (evalTaskId) summary.matched++;
          } else {
            summary.updated++;
          }
        } catch (err) {
          summary.errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`);
          summary.skipped++;
        }
      }
    }

    console.log('[task-disputes/import] POST completed:', {
      userId: user.id,
      totalRows: records.length,
      ...summary,
    });

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[task-disputes/import] POST failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
