export declare function findSimilarRecords(targetId: string, limit?: number): Promise<{
    record: {
        id: string;
        content: string;
        projectId: string;
        type: string;
    };
    similarity: number;
}[]>;
//# sourceMappingURL=index.d.ts.map