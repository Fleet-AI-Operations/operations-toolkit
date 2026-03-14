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
    environment: string;
    modelConfigId: string;
    status: import("@prisma/client").$Enums.JobStatus;
    totalRecords: number;
    processedCount: number;
    errorCount: number;
    tokensUsed: number;
    cost: number;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
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
    environment: string;
    modelConfigId: string;
    status: import("@prisma/client").$Enums.JobStatus;
    totalRecords: number;
    processedCount: number;
    errorCount: number;
    tokensUsed: number;
    cost: number;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
})[]>;
/**
 * Start bulk evaluation for all active models
 */
export declare function startBulkEvaluationAllModels(environment: string): Promise<string[]>;
//# sourceMappingURL=index.d.ts.map