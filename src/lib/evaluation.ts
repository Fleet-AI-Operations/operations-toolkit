import { prisma } from '@/lib/prisma';
import { JobStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import {
    LLM_SYSTEM_UUID,
    DEFAULT_SYSTEM_PROMPT,
    LLMConfig,
    HTTPHeaders,
    EnvDefaults,
    API_ENDPOINTS
} from '@/lib/constants';

interface EvaluationResult {
    realism: number;
    quality: number;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
}

/**
 * Start a bulk evaluation job
 * This function creates the job record and triggers the first batch asynchronously.
 */
export async function startBulkEvaluation(
    projectId: string,
    modelConfigId: string
): Promise<string> {
    // 1. Validation
    const modelConfig = await prisma.lLMModelConfig.findUnique({
        where: { id: modelConfigId }
    });

    if (!modelConfig || !modelConfig.isActive) {
        throw new Error('Model configuration not found or inactive');
    }

    // 2. Check for existing running job
    const existingJob = await prisma.lLMEvaluationJob.findFirst({
        where: {
            projectId,
            modelConfigId,
            status: { in: ['PENDING', 'PROCESSING'] }
        }
    });

    if (existingJob) return existingJob.id;

    // 3. Count records to be processed
    const existingScores = await prisma.likertScore.findMany({
        where: {
            userId: LLM_SYSTEM_UUID,
            llmModel: modelConfig.modelId,
            record: { projectId }
        },
        select: { recordId: true }
    });
    const evaluatedIds = new Set(existingScores.map(s => s.recordId));

    const totalRecords = await prisma.dataRecord.count({
        where: {
            projectId,
            id: { notIn: Array.from(evaluatedIds) }
        }
    });

    if (totalRecords === 0) {
        throw new Error('All records have already been evaluated by this model');
    }

    // 4. Create Job
    const job = await prisma.lLMEvaluationJob.create({
        data: {
            projectId,
            modelConfigId,
            status: 'PENDING',
            totalRecords
        }
    });

    // 5. Trigger the first batch (Fire & Forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || EnvDefaults.NEXT_PUBLIC_APP_URL;
    fetch(`${baseUrl}/api/evaluation/bulk-llm/process`, {
        method: 'POST',
        headers: { [HTTPHeaders.CONTENT_TYPE]: 'application/json' },
        body: JSON.stringify({ jobId: job.id })
    }).catch(err => console.error('Failed to trigger initial batch:', err));

    return job.id;
}

/**
 * Process a SINGLE batch of records.
 * Called recursively by the API route until finished.
 */
export async function processEvaluationBatch(jobId: string): Promise<{ completed: boolean; processed: number }> {
    const BATCH_SIZE = 5; // Conservative batch size to ensure quick execution

    const job = await prisma.lLMEvaluationJob.findUnique({
        where: { id: jobId },
        include: { modelConfig: true }
    });

    // Stop if job is not in a runnable state
    if (!job || ['CANCELLED', 'FAILED', 'COMPLETED'].includes(job.status)) {
        return { completed: true, processed: 0 };
    }

    // Mark as processing
    if (job.status === 'PENDING') {
        await prisma.lLMEvaluationJob.update({
            where: { id: jobId },
            data: { status: 'PROCESSING', startedAt: new Date() }
        });
    }

    // Find next batch of unevaluated records
    const evaluated = await prisma.likertScore.findMany({
        where: {
            userId: LLM_SYSTEM_UUID,
            llmModel: job.modelConfig.modelId,
            record: { projectId: job.projectId }
        },
        select: { recordId: true }
    });
    const evaluatedIds = evaluated.map(e => e.recordId);

    const records = await prisma.dataRecord.findMany({
        where: {
            projectId: job.projectId,
            id: { notIn: evaluatedIds }
        },
        take: BATCH_SIZE,
        select: { id: true, content: true }
    });

    // If no records left, mark job complete
    if (records.length === 0) {
        await prisma.lLMEvaluationJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', completedAt: new Date() }
        });
        return { completed: true, processed: 0 };
    }

    // Process the batch
    let processedInBatch = 0;
    let errorsInBatch = 0;
    let tokens = 0;
    let cost = 0;

    const apiKeySetting = await prisma.systemSetting.findUnique({ where: { key: 'openrouter_key' } });
    const apiKey = apiKeySetting?.value || process.env.OPENROUTER_API_KEY;
    const systemPrompt = job.modelConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (!apiKey) throw new Error("API Key missing");

    for (const record of records) {
        try {
            const result = await callLLMForEvaluation(
                API_ENDPOINTS.OPENROUTER_BASE,
                apiKey,
                job.modelConfig.modelId,
                record.content,
                systemPrompt
            );

            if (result) {
                // Check if score already exists for this record/user/model combo
                const existingScore = await prisma.likertScore.findFirst({
                    where: {
                        recordId: record.id,
                        userId: LLM_SYSTEM_UUID,
                        llmModel: job.modelConfig.modelId
                    }
                });

                if (existingScore) {
                    await prisma.likertScore.update({
                        where: { id: existingScore.id },
                        data: {
                            realismScore: result.realism,
                            qualityScore: result.quality
                        }
                    });
                } else {
                    await prisma.likertScore.create({
                        data: {
                            id: createId(),
                            recordId: record.id,
                            userId: LLM_SYSTEM_UUID,
                            realismScore: result.realism,
                            qualityScore: result.quality,
                            llmModel: job.modelConfig.modelId
                        }
                    });
                }

                tokens += result.tokensUsed || 0;

                // Calculate cost (works if at least one cost is configured)
                const inputCostPer1k = job.modelConfig.inputCostPer1k ?? 0;
                const outputCostPer1k = job.modelConfig.outputCostPer1k ?? 0;

                if (inputCostPer1k > 0 || outputCostPer1k > 0) {
                    const inputCost = (result.promptTokens || 0) * (inputCostPer1k / 1000);
                    const outputCost = (result.completionTokens || 0) * (outputCostPer1k / 1000);
                    cost += inputCost + outputCost;
                }

                processedInBatch++;
            } else {
                errorsInBatch++;
            }
        } catch (e) {
            console.error(`Error evaluating record ${record.id}`, e);
            errorsInBatch++;
        }
    }

    // Update Job Progress
    await prisma.lLMEvaluationJob.update({
        where: { id: jobId },
        data: {
            processedCount: { increment: processedInBatch },
            errorCount: { increment: errorsInBatch },
            tokensUsed: { increment: tokens },
            cost: { increment: cost }
        }
    });

    // Update Model Stats
    await prisma.lLMModelConfig.update({
        where: { id: job.modelConfigId },
        data: {
            totalTokensUsed: { increment: tokens },
            totalCost: { increment: cost },
            totalRatings: { increment: processedInBatch }
        }
    });

    return { completed: false, processed: processedInBatch };
}

// Helper to call LLM
async function callLLMForEvaluation(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    content: string,
    systemPrompt: string
): Promise<EvaluationResult | null> {
    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                [HTTPHeaders.AUTHORIZATION]: `Bearer ${apiKey}`,
                [HTTPHeaders.CONTENT_TYPE]: 'application/json',
                [HTTPHeaders.REFERER]: process.env.NEXT_PUBLIC_APP_URL || EnvDefaults.NEXT_PUBLIC_APP_URL,
                [HTTPHeaders.TITLE]: HTTPHeaders.BULK_EVAL_TITLE
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Please evaluate this prompt:\n\n${content}` }
                ],
                max_tokens: LLMConfig.EVALUATION_MAX_TOKENS,
                temperature: LLMConfig.EVALUATION_TEMPERATURE
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`LLM API error for model ${modelId}: ${response.status} ${response.statusText}`, errorText);
            return null;
        }

        const data = await response.json();
        const responseContent = data.choices?.[0]?.message?.content || '';
        const usage = data.usage || {};

        if (!responseContent) {
            console.error(`Empty response from model ${modelId}:`, JSON.stringify(data));
            return null;
        }

        const jsonMatch = responseContent.match(/\{[^}]+\}/);
        if (!jsonMatch) {
            console.error(`No JSON found in response from model ${modelId}:`, responseContent.substring(0, 200));
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (typeof parsed.realism !== 'number' || typeof parsed.quality !== 'number') {
            console.error(`Invalid score format from model ${modelId}:`, jsonMatch[0]);
            return null;
        }

        return {
            realism: Math.max(1, Math.min(7, Math.round(parsed.realism))),
            quality: Math.max(1, Math.min(7, Math.round(parsed.quality))),
            tokensUsed: usage.total_tokens || 0,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0
        };
    } catch (e) {
        console.error(`Exception in callLLMForEvaluation for model ${modelId}:`, e);
        return null;
    }
}

/**
 * Cancel a running evaluation job
 */
export async function cancelEvaluation(jobId: string): Promise<boolean> {
    await prisma.lLMEvaluationJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
    });

    return true;
}

/**
 * Get job status
 */
export async function getEvaluationJobStatus(jobId: string) {
    return prisma.lLMEvaluationJob.findUnique({
        where: { id: jobId },
        include: {
            modelConfig: {
                select: { name: true, modelId: true }
            },
            project: {
                select: { name: true }
            }
        }
    });
}

/**
 * Get all evaluation jobs for a project
 */
export async function getProjectEvaluationJobs(projectId: string, limit = 20) {
    return prisma.lLMEvaluationJob.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            modelConfig: {
                select: { name: true, modelId: true }
            }
        }
    });
}

/**
 * Start bulk evaluation for all active models
 */
export async function startBulkEvaluationAllModels(projectId: string): Promise<string[]> {
    const activeModels = await prisma.lLMModelConfig.findMany({
        where: { isActive: true },
        orderBy: { priority: 'asc' }
    });

    const jobIds: string[] = [];

    for (const model of activeModels) {
        try {
            const jobId = await startBulkEvaluation(projectId, model.id);
            jobIds.push(jobId);
        } catch (err) {
            console.error(`Failed to start evaluation for model ${model.name}:`, err);
        }
    }

    return jobIds;
}
