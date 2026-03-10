import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@repo/database'
import { parse } from 'csv-parse/sync'
import { requireRole } from '@repo/api-utils'
import { ERROR_IDS } from '@/constants/errorIds'

export const dynamic = 'force-dynamic'

interface CSVRow {
    rating_id: string;
    feedback_id: string;
    feedback_content?: string;
    eval_task_id?: string;
    is_helpful: string;
    is_dispute?: string;
    dispute_status?: string;
    dispute_reason?: string;
    rater_name?: string;
    rater_email: string;
    qa_name?: string;
    qa_email: string;
    rated_at: string;
    resolved_at?: string;
    resolved_by_name?: string;
    resolution_reason?: string;
    // Task fields
    task_id?: string;
    task_key?: string;
    task_prompt?: string;
    task_creator_name?: string;
    task_creator_email?: string;
    task_created_at?: string;
    env_key?: string;
    env_version?: string;
    env_data_key?: string;
    scenario_title?: string;
    task_modality?: string;
}

interface ImportSummary {
    imported: number;
    updated: number;
    skipped: number;
    tasksCreated: number;
    errors: string[];
}

// POST: Import QA feedback ratings from CSV
export async function POST(req: NextRequest) {
    const authResult = await requireRole(req, ['ADMIN'])
    if (authResult.error) return authResult.error
    const { user } = authResult

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({
                error: 'No file provided',
                errorId: ERROR_IDS.INVALID_INPUT
            }, { status: 400 })
        }

        // Read file content
        const fileContent = await file.text()

        // Parse CSV
        let records: CSVRow[]
        try {
            records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            })
        } catch (parseError) {
            console.error('[QA Feedback Import API] CSV parsing error:', {
                errorId: ERROR_IDS.INVALID_INPUT,
                error: parseError instanceof Error ? parseError.message : String(parseError)
            })
            return NextResponse.json({
                error: 'Failed to parse CSV file',
                errorId: ERROR_IDS.INVALID_INPUT
            }, { status: 400 })
        }

        if (records.length === 0) {
            return NextResponse.json({
                error: 'CSV file is empty',
                errorId: ERROR_IDS.INVALID_INPUT
            }, { status: 400 })
        }

        const summary: ImportSummary = {
            imported: 0,
            updated: 0,
            skipped: 0,
            tasksCreated: 0,
            errors: []
        }

        // Process in batches of 500
        const BATCH_SIZE = 500
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE)

            for (const row of batch) {
                try {
                    // Validate required fields
                    const missingFields: string[] = []
                    if (!row.rating_id) missingFields.push('rating_id')
                    if (!row.feedback_id) missingFields.push('feedback_id')
                    if (!row.is_helpful) missingFields.push('is_helpful')
                    if (!row.rated_at) missingFields.push('rated_at')
                    if (!row.rater_email) missingFields.push('rater_email')
                    if (!row.qa_email) missingFields.push('qa_email')

                    if (missingFields.length > 0) {
                        summary.errors.push(`Row ${i + batch.indexOf(row) + 2}: Missing required fields: ${missingFields.join(', ')}`)
                        summary.skipped++
                        continue
                    }

                    // Parse dates
                    let ratedAt: Date
                    try {
                        ratedAt = new Date(row.rated_at)
                        if (isNaN(ratedAt.getTime())) {
                            throw new Error('Invalid date')
                        }
                    } catch {
                        summary.errors.push(`Row ${i + batch.indexOf(row) + 2}: Invalid rated_at date format`)
                        summary.skipped++
                        continue
                    }

                    let resolvedAt: Date | null = null
                    if (row.resolved_at) {
                        try {
                            resolvedAt = new Date(row.resolved_at)
                            if (isNaN(resolvedAt.getTime())) {
                                resolvedAt = null
                            }
                        } catch {
                            // Skip invalid resolved_at dates
                        }
                    }

                    // Parse boolean is_helpful
                    const isHelpful = row.is_helpful.toLowerCase() === 'true' || row.is_helpful === '1'

                    // Create task record if it doesn't exist
                    let evalTaskId: string | null = null
                    if (row.task_id && row.task_prompt) {
                        // Check if task exists
                        let taskExists = await prisma.dataRecord.findUnique({
                            where: { id: row.task_id },
                            select: { id: true }
                        })

                        if (!taskExists) {
                            // Create task record
                            try {
                                const taskCreatedAt = row.task_created_at ? new Date(row.task_created_at) : new Date()

                                await prisma.dataRecord.create({
                                    data: {
                                        id: row.task_id,
                                        type: 'TASK',
                                        environment: row.env_key || 'unknown',
                                        source: 'qa_feedback_import',
                                        content: row.task_prompt,
                                        createdByEmail: row.task_creator_email || null,
                                        createdByName: row.task_creator_name || null,
                                        createdAt: taskCreatedAt,
                                        updatedAt: taskCreatedAt,
                                        metadata: {
                                            task_key: row.task_key || null,
                                            env_key: row.env_key || null,
                                            env_version: row.env_version || null,
                                            env_data_key: row.env_data_key || null,
                                            scenario_title: row.scenario_title || null,
                                            environment_name: row.env_key || null,
                                            task_modality: row.task_modality || null,
                                        }
                                    }
                                })
                                summary.tasksCreated++
                                taskExists = { id: row.task_id } // Mark as created
                            } catch (taskError) {
                                // If task creation fails, log and skip linking
                                console.warn(`Failed to create task ${row.task_id}:`, taskError)
                                taskExists = null
                            }
                        }

                        // Only set evalTaskId if task exists or was successfully created
                        if (taskExists) {
                            evalTaskId = row.task_id
                        }
                    } else if (row.eval_task_id) {
                        // Fallback: check if eval_task_id exists (for old format CSVs)
                        const taskExists = await prisma.dataRecord.findUnique({
                            where: { id: row.eval_task_id },
                            select: { id: true }
                        })
                        if (taskExists) {
                            evalTaskId = row.eval_task_id
                        }
                    }

                    // Check if rating already exists
                    const existing = await prisma.qAFeedbackRating.findUnique({
                        where: { ratingId: row.rating_id }
                    })

                    if (existing) {
                        // Update existing record
                        await prisma.qAFeedbackRating.update({
                            where: { ratingId: row.rating_id },
                            data: {
                                feedbackId: row.feedback_id,
                                feedbackContent: row.feedback_content || null,
                                evalTaskId: evalTaskId,
                                isHelpful,
                                isDispute: row.is_dispute?.toLowerCase() === 'true' || row.is_dispute === '1' || false,
                                disputeStatus: row.dispute_status || null,
                                disputeReason: row.dispute_reason || null,
                                raterName: row.rater_name || null,
                                raterEmail: row.rater_email,
                                qaName: row.qa_name || null,
                                qaEmail: row.qa_email,
                                ratedAt,
                                resolvedAt,
                                resolvedByName: row.resolved_by_name || null,
                                resolutionReason: row.resolution_reason || null,
                            }
                        })
                        summary.updated++
                    } else {
                        // Insert new record
                        await prisma.qAFeedbackRating.create({
                            data: {
                                ratingId: row.rating_id,
                                feedbackId: row.feedback_id,
                                feedbackContent: row.feedback_content || null,
                                evalTaskId: evalTaskId,
                                isHelpful,
                                isDispute: row.is_dispute?.toLowerCase() === 'true' || row.is_dispute === '1' || false,
                                disputeStatus: row.dispute_status || null,
                                disputeReason: row.dispute_reason || null,
                                raterName: row.rater_name || null,
                                raterEmail: row.rater_email,
                                qaName: row.qa_name || null,
                                qaEmail: row.qa_email,
                                ratedAt,
                                resolvedAt,
                                resolvedByName: row.resolved_by_name || null,
                                resolutionReason: row.resolution_reason || null,
                            }
                        })
                        summary.imported++
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error)
                    summary.errors.push(`Row ${i + batch.indexOf(row) + 2}: ${errorMsg}`)
                    summary.skipped++
                }
            }
        }

        console.log('[QA Feedback Import API] Import completed:', {
            userId: user.id,
            totalRows: records.length,
            imported: summary.imported,
            updated: summary.updated,
            skipped: summary.skipped,
            tasksCreated: summary.tasksCreated,
            errorCount: summary.errors.length
        })

        return NextResponse.json({
            success: true,
            summary
        })
    } catch (error) {
        console.error('[QA Feedback Import API] Unexpected error:', {
            errorId: ERROR_IDS.SYSTEM_ERROR,
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        return NextResponse.json({
            error: 'An unexpected error occurred during import',
            errorId: ERROR_IDS.SYSTEM_ERROR
        }, { status: 500 })
    }
}
