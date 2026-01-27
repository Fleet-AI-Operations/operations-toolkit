import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedding, cosineSimilarity } from '../ai';

// Mock fetch
global.fetch = vi.fn();

describe('AI Library Utilities', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getEmbedding', () => {
        it('should return a vector when the API call is successful', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3];
            (fetch as any).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ embedding: mockEmbedding }]
                }),
            });

            const result = await getEmbedding('hello world');
            expect(result).toEqual(mockEmbedding);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should return an empty array if the API fails', async () => {
            (fetch as any).mockResolvedValue({
                ok: false,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ error: 'Server exploded' }),
            });

            const result = await getEmbedding('hello world');
            expect(result).toEqual([]);
        });

        it('should return an empty array if the input is empty', async () => {
            const result = await getEmbedding('');
            expect(result).toEqual([]);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    describe('cosineSimilarity', () => {
        it('should correctly calculate similarity between identical vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [1, 0, 0];
            const similarity = cosineSimilarity(vecA, vecB);
            expect(similarity).toBeCloseTo(1.0);
        });

        it('should correctly calculate similarity between orthogonal vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];
            const similarity = cosineSimilarity(vecA, vecB);
            expect(similarity).toBe(0);
        });

        it('should return 0 for zero vectors', () => {
            const vecA = [0, 0, 0];
            const vecB = [1, 1, 1];
            const similarity = cosineSimilarity(vecA, vecB);
            expect(similarity).toBe(0);
        });
    });

    describe('Provider Selection', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            vi.resetModules();
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should default to lmstudio when NO OpenRouter key is present', async () => {
            delete process.env.OPENROUTER_API_KEY;
            // We intentionally re-import to trigger the module to read the env var again if it were cached, 
            // though getActiveProvider reads it on every call, so this is safe.
            const { getActiveProvider } = await import('../ai');
            expect(getActiveProvider()).toBe('lmstudio');
        });

        it('should switch to openrouter when OpenRouter key IS present', async () => {
            process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
            const { getActiveProvider } = await import('../ai');
            expect(getActiveProvider()).toBe('openrouter');
        });
    });
});
