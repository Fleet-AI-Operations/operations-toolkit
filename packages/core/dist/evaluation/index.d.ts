/**
 * Start a bulk evaluation job
 * This function creates the job record and triggers the first batch asynchronously.
 */
export declare function startBulkEvaluation(environment: string, modelConfigId: string): Promise<string>;
/**
 * Process a SINGLE batch of records.
 * Called recursively by the API route until finished.
 */
export declare function processEvaluationBatch(jobId: string): Promise<{
    completed: boolean;
    processed: number;
}>;
/**
 * Cancel a running evaluation job
 */
export declare function cancelEvaluation(jobId: string): Promise<boolean>;
/**
 * Get job status
 */
export declare function getEvaluationJobStatus(jobId: string): Promise<({
    modelConfig: {
        name: string;
        modelId: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import("@prisma/client").$Enums.JobStatus;
    error: string | null;
    environment: string;
    totalRecords: number;
    processedCount: number;
    modelConfigId: string;
    errorCount: number;
    tokensUsed: number;
    cost: number;
    startedAt: Date | null;
    completedAt: Date | null;
}) | null>;
/**
 * Get all evaluation jobs for an environment
 */
export declare function getEnvironmentEvaluationJobs(environment: string, limit?: number): Promise<({
    modelConfig: {
        name: string;
        modelId: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import("@prisma/client").$Enums.JobStatus;
    error: string | null;
    environment: string;
    totalRecords: number;
    processedCount: number;
    modelConfigId: string;
    errorCount: number;
    tokensUsed: number;
    cost: number;
    startedAt: Date | null;
    completedAt: Date | null;
})[]>;
/**
 * Start bulk evaluation for all active models
 */
export declare function startBulkEvaluationAllModels(environment: string): Promise<string[]>;
//# sourceMappingURL=index.d.ts.map