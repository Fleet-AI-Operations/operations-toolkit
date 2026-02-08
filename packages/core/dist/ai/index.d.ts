/**
 * AI SERVICE LAYER
 * Abstraction layer for interacting with LLM and Embedding models.
 * Supports multiple providers:
 *   - LM Studio (default, localhost:1234)
 *   - OpenRouter (cloud, requires API key)
 */
export type AIProvider = 'lmstudio' | 'openrouter';
export interface UsageInfo {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
}
export interface CompletionResult {
    content: string;
    usage?: UsageInfo;
    provider: AIProvider;
}
export interface BalanceInfo {
    credits: number;
    usage: number;
    limit?: number;
}
/**
 * Returns the current active provider name for diagnostics.
 */
export declare function getActiveProvider(): Promise<AIProvider>;
/**
 * Generates a vector embedding for a given string.
 * Used for semantic search and finding similar prompts/feedback.
 * Returns an empty array on failure (caller should check length before storing).
 */
export declare function getEmbedding(text: string): Promise<number[]>;
/**
 * Generates vector embeddings for a batch of strings.
 * Significantly faster than individual requests for large datasets.
 * Supports both LM Studio and OpenRouter providers.
 */
export declare function getEmbeddings(texts: string[]): Promise<number[][]>;
/**
 * Chat Completion with usage tracking.
 * Returns content along with token usage and cost information (when available from OpenRouter).
 */
export declare function generateCompletionWithUsage(prompt: string, systemPrompt?: string): Promise<CompletionResult>;
/**
 * Standard Chat Completion entry point.
 * Used for summarizing trends and performing guideline alignment checks.
 * Supports both LM Studio and OpenRouter providers.
 */
export declare function generateCompletion(prompt: string, systemPrompt?: string): Promise<string>;
/**
 * Math utility for semantic distance.
 * 1.0 = identical meaning, 0.0 = completely unrelated.
 */
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
/**
 * Computes cross-encoded similarity score between two texts using LLM.
 * This uses the chat completion API to have the model assess semantic similarity.
 *
 * Cross-encoders take both texts as input simultaneously (unlike bi-encoders which
 * encode texts separately), providing more accurate similarity assessment.
 *
 * Returns a similarity score from 0-100.
 */
export interface CrossEncoderResult {
    score: number;
    reasoning?: string;
    llmModel?: string;
}
export declare function computeCrossEncoderSimilarity(text1: string, text2: string): Promise<CrossEncoderResult>;
/**
 * Fetches the current OpenRouter API key balance.
 * Returns null if not using OpenRouter or if the request fails.
 */
export declare function getOpenRouterBalance(): Promise<BalanceInfo | null>;
//# sourceMappingURL=index.d.ts.map