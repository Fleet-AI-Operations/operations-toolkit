export declare function findSimilarRecords(targetId: string, limit?: number): Promise<{
    record: {
        id: string;
        content: string;
        environment: string;
        type: string;
    };
    similarity: number;
}[]>;
/**
 * Starts a background similarity detection job for newly ingested records.
 * Creates a SimilarityJob record, fires runSimilarityDetection() asynchronously,
 * and returns the job ID immediately.
 */
export declare function startSimilarityDetection(ingestJobId: string, environment: string): Promise<string>;
//# sourceMappingURL=index.d.ts.map