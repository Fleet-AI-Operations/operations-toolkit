/**
 * AI SERVICE LAYER
 * Abstraction layer for interacting with LLM and Embedding models.
 * Supports multiple providers:
 *   - LM Studio (default, localhost:1234)
 *   - OpenRouter (cloud, requires API key)
 */
import { prisma } from '@repo/database';
import { notifyAICallUsed } from '../notifications/email-service';
/**
 * Detects and returns the active AI provider configuration.
 * Priority: Database Settings > OpenRouter (if key provided in env) > LM Studio (default)
 */
async function getProviderConfig() {
    // 1. Try to fetch settings from DB
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: ['ai_provider', 'ai_host', 'llm_model', 'embedding_model', 'openrouter_key'] }
            }
        });
        const getSetting = (k) => settings.find(s => s.key === k)?.value;
        const dbProvider = getSetting('ai_provider');
        if (dbProvider) {
            // If DB has explicit provider, use it (with fallbacks to env or defaults for standard fields)
            if (dbProvider === 'openrouter') {
                return {
                    provider: 'openrouter',
                    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
                    llmModel: getSetting('llm_model') || process.env.OPENROUTER_LLM_MODEL || 'anthropic/claude-3.5-sonnet',
                    embeddingModel: getSetting('embedding_model') || process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small',
                    apiKey: getSetting('openrouter_key') || process.env.OPENROUTER_API_KEY,
                };
            }
            else {
                return {
                    provider: 'lmstudio',
                    baseUrl: getSetting('ai_host') || process.env.AI_HOST || 'http://localhost:1234/v1',
                    llmModel: getSetting('llm_model') || process.env.LLM_MODEL || 'meta-llama-3-8b-instruct',
                    embeddingModel: getSetting('embedding_model') || process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5',
                };
            }
        }
    }
    catch (e) {
        console.warn('Failed to fetch system settings:', e);
    }
    // 2. Fallback to Env vars (Existing logic)
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
        return {
            provider: 'openrouter',
            baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            llmModel: process.env.OPENROUTER_LLM_MODEL || 'anthropic/claude-3.5-sonnet',
            embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small',
            apiKey: openRouterKey,
        };
    }
    // Default to LM Studio
    return {
        provider: 'lmstudio',
        baseUrl: process.env.AI_HOST || 'http://localhost:1234/v1',
        llmModel: process.env.LLM_MODEL || 'meta-llama-3-8b-instruct',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5',
    };
}
/**
 * Builds request headers based on the provider.
 */
function getHeaders(config) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (config.provider === 'openrouter' && config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER || 'http://localhost:3000';
        headers['X-Title'] = process.env.OPENROUTER_TITLE || 'Operations Tools';
    }
    return headers;
}
/**
 * Returns the current active provider name for diagnostics.
 */
export async function getActiveProvider() {
    return (await getProviderConfig()).provider;
}
/**
 * Generates a vector embedding for a given string.
 * Used for semantic search and finding similar prompts/feedback.
 * Returns an empty array on failure (caller should check length before storing).
 */
export async function getEmbedding(text) {
    const embeddings = await getEmbeddings([text]);
    return embeddings[0] || [];
}
/**
 * Generates vector embeddings for a batch of strings.
 * Significantly faster than individual requests for large datasets.
 * Supports both LM Studio and OpenRouter providers.
 */
export async function getEmbeddings(texts) {
    const config = await getProviderConfig();
    const TIMEOUT_MS = 60000; // 60 second timeout for embedding requests
    // Log configuration for debugging OpenRouter issues
    console.log(`[Embeddings] Provider config: ${config.provider}, model: ${config.embeddingModel}, baseUrl: ${config.baseUrl}, hasApiKey: ${!!config.apiKey}`);
    // Validate OpenRouter configuration
    if (config.provider === 'openrouter' && !config.apiKey) {
        console.error('[Embeddings] OpenRouter selected but no API key configured! Check openrouter_key in DB or OPENROUTER_API_KEY env var.');
        return texts.map(() => []);
    }
    // SANITIZE: Remove empty strings and handle malformed inputs to reduce tokenizer warnings.
    // This prevents the "last token is not SEP" warning from common embedding models (like Qwen).
    const sanitizedInput = texts.map(t => (typeof t === 'string' ? t.trim() : ''));
    if (sanitizedInput.every(t => t.length === 0)) {
        console.warn('[Embeddings] All inputs are empty, returning empty embeddings');
        return texts.map(() => []);
    }
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        console.log(`[Embeddings] Requesting ${texts.length} embeddings from ${config.provider} (model: ${config.embeddingModel})`);
        const response = await fetch(`${config.baseUrl}/embeddings`, {
            method: 'POST',
            headers: getHeaders(config),
            body: JSON.stringify({
                model: config.embeddingModel,
                input: sanitizedInput,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = `${config.provider} embedding error (${response.status}): ${response.statusText}`;
            console.error(`[Embeddings] ${errorMsg}`);
            console.error(`[Embeddings] Error details:`, JSON.stringify(errorData, null, 2));
            // Provide specific guidance for common errors
            if (response.status === 401) {
                console.error('[Embeddings] 401 Unauthorized - API key is invalid or missing');
            }
            else if (response.status === 402) {
                console.error('[Embeddings] 402 Payment Required - Insufficient OpenRouter credits');
            }
            else if (response.status === 404) {
                console.error(`[Embeddings] 404 Not Found - Model "${config.embeddingModel}" may not exist or may not be an embedding model`);
            }
            else if (response.status === 429) {
                console.error('[Embeddings] 429 Rate Limited - Too many requests');
            }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        console.log(`[Embeddings] Raw response structure:`, Object.keys(data));
        // Validate response structure
        if (!data || typeof data !== 'object') {
            console.error(`[Embeddings] Response is not an object from ${config.provider}`);
            throw new Error(`Invalid embedding response: response is not an object`);
        }
        if (!data.data) {
            console.error(`[Embeddings] Missing 'data' field from ${config.provider}:`, JSON.stringify(data).slice(0, 500));
            throw new Error(`Invalid embedding response: missing 'data' field`);
        }
        if (!Array.isArray(data.data)) {
            console.error(`[Embeddings] 'data' field is not an array from ${config.provider}:`, typeof data.data, JSON.stringify(data).slice(0, 500));
            throw new Error(`Invalid embedding response: 'data' is not an array (type: ${typeof data.data})`);
        }
        // Log first item structure for debugging
        if (data.data.length > 0) {
            const firstItem = data.data[0];
            console.log(`[Embeddings] First item keys:`, Object.keys(firstItem));
            console.log(`[Embeddings] Embedding length:`, firstItem.embedding?.length || 'N/A');
        }
        // Validate that we received the correct number of embeddings
        if (data.data.length !== texts.length) {
            console.error(`[Embeddings] Response count mismatch: requested ${texts.length} embeddings, got ${data.data.length}`);
            throw new Error(`Embedding response count mismatch: expected ${texts.length}, got ${data.data.length}`);
        }
        const embeddings = data.data.map((item) => item.embedding);
        // Validate that we got actual embeddings
        const validCount = embeddings.filter((e) => Array.isArray(e) && e.length > 0).length;
        if (validCount === 0) {
            console.error(`[Embeddings] No valid embeddings in response from ${config.provider}`);
            console.error(`[Embeddings] Sample item:`, JSON.stringify(data.data[0]).slice(0, 200));
            throw new Error(`No valid embeddings returned`);
        }
        console.log(`[Embeddings] Received ${validCount}/${texts.length} valid embeddings`);
        return embeddings;
    }
    catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[Embeddings] Request timed out after ${TIMEOUT_MS}ms`);
        }
        else {
            console.error(`[Embeddings] Error from ${config.provider}:`, error.message);
        }
        // Return empty embeddings for the batch on failure
        return texts.map(() => []);
    }
}
/**
 * Chat Completion with usage tracking.
 * Returns content along with token usage and cost information (when available from OpenRouter).
 */
export async function generateCompletionWithUsage(prompt, systemPrompt) {
    const config = await getProviderConfig();
    // TRUNCATION STRATEGY:
    // Large prompts (e.g., analyzing 500+ records) can exceed context limits.
    // We apply a safe character limit (approx 20k chars ~ 5k tokens) to prevent 400 errors from LM Studio/OpenRouter.
    const MAX_PROMPT_CHARS = 20000;
    const truncatedPrompt = prompt.length > MAX_PROMPT_CHARS
        ? prompt.slice(0, MAX_PROMPT_CHARS) + "\n\n[...Truncated due to length...]"
        : prompt;
    try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: getHeaders(config),
            body: JSON.stringify({
                model: config.llmModel,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: truncatedPrompt }
                ],
                temperature: 0.7,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${config.provider} error: ${response.statusText} ${JSON.stringify(errorData)}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const result = {
            content,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
                cost: data.usage.cost,
            } : undefined,
            provider: config.provider,
        };
        // Send email notification to configured admins (non-blocking, fire-and-forget)
        // WARNING: This fires on EVERY AI call. During bulk operations (alignment analysis,
        // ingestion with embeddings), this can generate hundreds of emails. Consider disabling
        // AI_CALL_USED notifications in admin settings unless specifically needed for monitoring.
        notifyAICallUsed({
            operation: 'LLM Completion',
            model: config.llmModel,
            cost: result.usage?.cost
        }).catch(() => {
            // Silently ignore notification failures to not impact AI operations
        });
        return result;
    }
    catch (error) {
        console.error(`Error in completion (${config.provider}):`, error);
        const errorMessage = config.provider === 'openrouter'
            ? `Analysis Error: ${error.message}. Please verify your OpenRouter API key and that the model "${config.llmModel}" is available.`
            : `Analysis Error: ${error.message}. Please verify that LM Studio is running at ${config.baseUrl} and that the model "${config.llmModel}" is loaded.`;
        return {
            content: errorMessage,
            provider: config.provider,
        };
    }
}
/**
 * Standard Chat Completion entry point.
 * Used for summarizing trends and performing guideline alignment checks.
 * Supports both LM Studio and OpenRouter providers.
 */
export async function generateCompletion(prompt, systemPrompt) {
    const result = await generateCompletionWithUsage(prompt, systemPrompt);
    return result.content;
}
/**
 * Math utility for semantic distance.
 * 1.0 = identical meaning, 0.0 = completely unrelated.
 */
export function cosineSimilarity(vecA, vecB) {
    // Validate inputs
    if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) {
        console.warn('[cosineSimilarity] Invalid input: vectors must be arrays');
        return 0;
    }
    // Check dimension mismatch
    if (vecA.length !== vecB.length) {
        console.warn(`[cosineSimilarity] Dimension mismatch: vecA=${vecA.length}, vecB=${vecB.length}`);
        return 0;
    }
    // Empty vectors
    if (vecA.length === 0 || vecB.length === 0) {
        return 0;
    }
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magA === 0 || magB === 0)
        return 0;
    return dotProduct / (magA * magB);
}
export async function computeCrossEncoderSimilarity(text1, text2) {
    if (text1.trim().toLowerCase() === text2.trim().toLowerCase()) {
        return { score: 100, reasoning: 'Texts are identical', llmModel: (await getProviderConfig()).llmModel };
    }
    const config = await getProviderConfig();
    console.log(`[CrossEncoder] Computing similarity using ${config.provider}`);
    const systemPrompt = `You are a semantic similarity expert analyzing two prompts.
    Evaluate similarity by comparing:
    - **Primary objective**: What is the main task or goal being requested?
    - **Key details**: Are the same entities, names, projects, or specific information mentioned?
    - **Instructions & constraints**: Do they require the same actions, format, style, or tone?
    - **Context & scope**: Are they addressing the same situation or use case?

    Provide a precise similarity score (e.g., don't always round to the nearest 5 or 10, but always use whole numbers and round up where necesasry).
    - Score 95-100: Functionally identical or trivial paraphrases
    - Score 80-94: Very similar with minor wording differences
    - Score 60-79: Similar core task with some different details
    - Score 40-59: Related topic but different approach or specifics
    - Score 20-39: Loosely related but different objectives
    - Score 0-19: Completely unrelated topics

    Output your response in valid JSON format:
    {
      "reasoning": "A one-sentence explanation of why they are similar or different",
      "score": number (0-100, decimals allowed)
    }`;
    const userPrompt = `Text 1: ${text1}\n\nText 2: ${text2}`;
    try {
        const requestBody = {
            model: config.llmModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0, // 0 is best for "classification" tasks like this
            max_tokens: 150, // Slightly more room for the 'reasoning'
            response_format: { type: 'json_object' }
        };
        // LMStudio requires json_schema with explicit schema
        if (config.provider !== 'openrouter') {
            requestBody.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: 'similarity_score',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            reasoning: {
                                type: 'string',
                                description: 'A one-sentence explanation of why the prompts are similar or different'
                            },
                            score: {
                                type: 'number',
                                description: 'Similarity score from 0-100'
                            }
                        },
                        required: ['reasoning', 'score'],
                        additionalProperties: false
                    }
                }
            };
        }
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: getHeaders(config),
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[CrossEncoder] ${config.provider} error:`, response.statusText, errorData);
            throw new Error(`API Error: ${response.statusText}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            console.error('[CrossEncoder] No content in response');
            return { score: 0, reasoning: 'No content in LLM response' };
        }
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch (parseError) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                }
                catch (e) {
                    console.error('[CrossEncoder] Failed to parse extracted JSON:', e.message);
                    return { score: 0, reasoning: 'Failed to parse JSON from model output' };
                }
            }
            else {
                console.error('[CrossEncoder] Could not extract JSON from response:', content);
                return { score: 0, reasoning: 'Could not extract JSON from model output' };
            }
        }
        const reasoning = parsed.reasoning || parsed.explanation || '';
        const rawScore = parsed.score ?? parsed.similarity ?? 0;
        const numericScore = Number(rawScore) || 0;
        console.log(`[CrossEncoder] Reasoning: ${reasoning}`);
        console.log(`[CrossEncoder] Similarity score: ${numericScore}`);
        return { score: Math.max(0, Math.min(100, numericScore)), reasoning, llmModel: config.llmModel };
    }
    catch (error) {
        console.error(`[CrossEncoder] Error, returning 0:`, error.message);
        return { score: 0, reasoning: error.message || 'Error computing cross-encoder similarity', llmModel: config.llmModel };
    }
}
/**
 * Fetches the current OpenRouter API key balance.
 * Returns null if not using OpenRouter or if the request fails.
 */
export async function getOpenRouterBalance() {
    const config = await getProviderConfig();
    if (config.provider !== 'openrouter' || !config.apiKey) {
        return null;
    }
    try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
            },
        });
        if (!response.ok) {
            console.error('Failed to fetch OpenRouter balance:', response.statusText);
            return null;
        }
        const data = await response.json();
        const usage = data.data?.usage || 0;
        const limit = data.data?.limit;
        const limitRemaining = data.data?.limit_remaining;
        return {
            credits: limitRemaining ?? (limit ? limit - usage : 0),
            usage,
            limit,
        };
    }
    catch (error) {
        console.error('Error fetching OpenRouter balance:', error);
        return null;
    }
}
