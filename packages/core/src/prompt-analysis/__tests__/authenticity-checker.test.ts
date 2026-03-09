import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeTemplateUsage } from '../authenticity-checker';

vi.mock('../../ai', () => ({
  generateCompletionWithUsage: vi.fn(),
}));

function makeAIResponse(content: string, provider = 'openai', cost = 0.002) {
  return { content, provider, usage: { cost } };
}

function makeTemplateJSON(overrides: Record<string, any> = {}) {
  return JSON.stringify({
    isLikelyTemplated: false,
    templateConfidence: 0,
    templateIndicators: [],
    detectedTemplate: null,
    matchingPromptNumbers: [],
    overallAssessment: 'No template detected.',
    ...overrides,
  });
}

describe('analyzeTemplateUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Early return ──────────────────────────────────────────────────────────

  it('returns a not-templated sentinel without calling the AI when 0 prompts provided', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');

    const result = await analyzeTemplateUsage([]);

    expect(generateCompletionWithUsage).not.toHaveBeenCalled();
    expect(result.isLikelyTemplated).toBe(false);
    expect(result.matchingPromptIds).toHaveLength(0);
    expect(result.templateConfidence).toBe(0);
  });

  it('returns a not-templated sentinel without calling the AI when 1 prompt provided', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');

    const result = await analyzeTemplateUsage([{ id: 'p1', text: 'Hello world' }]);

    expect(generateCompletionWithUsage).not.toHaveBeenCalled();
    expect(result.isLikelyTemplated).toBe(false);
    expect(result.matchingPromptIds).toHaveLength(0);
  });

  // ── Index mapping ─────────────────────────────────────────────────────────

  it('maps 1-indexed matchingPromptNumbers back to prompt IDs correctly', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON({
        isLikelyTemplated: true,
        templateConfidence: 80,
        templateIndicators: ['Same structure'],
        detectedTemplate: 'Write a [X] about [Y]',
        matchingPromptNumbers: [1, 3],
        overallAssessment: 'Template detected.',
      })) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'Write a story about robots.' },
      { id: 'id-b', text: 'Something completely different.' },
      { id: 'id-c', text: 'Write a poem about the sea.' },
    ]);

    expect(result.matchingPromptIds).toEqual(['id-a', 'id-c']);
    expect(result.isLikelyTemplated).toBe(true);
    expect(result.templateConfidence).toBe(80);
  });

  it('filters out out-of-range matchingPromptNumbers (0, negative, > length)', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON({
        isLikelyTemplated: true,
        templateConfidence: 70,
        matchingPromptNumbers: [0, 2, 99],
      })) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'Prompt A' },
      { id: 'id-b', text: 'Prompt B' },
      { id: 'id-c', text: 'Prompt C' },
    ]);

    // Only 2 is valid (1-indexed → id-b)
    expect(result.matchingPromptIds).toEqual(['id-b']);
  });

  // ── Coherence guard ───────────────────────────────────────────────────────

  it('sets isLikelyTemplated to false when LLM returns true but matchingPromptNumbers is empty', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON({
        isLikelyTemplated: true,
        templateConfidence: 75,
        templateIndicators: ['Some indicator'],
        detectedTemplate: 'Write a [X]',
        matchingPromptNumbers: [],
      })) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'Prompt A' },
      { id: 'id-b', text: 'Prompt B' },
    ]);

    expect(result.isLikelyTemplated).toBe(false);
    expect(result.matchingPromptIds).toHaveLength(0);
  });

  // ── Confidence clamping ───────────────────────────────────────────────────

  it('clamps templateConfidence above 100 down to 100', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON({
        isLikelyTemplated: true,
        templateConfidence: 150,
        matchingPromptNumbers: [1],
      })) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'A' },
      { id: 'id-b', text: 'B' },
    ]);

    expect(result.templateConfidence).toBe(100);
  });

  it('clamps templateConfidence below 0 up to 0', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON({ templateConfidence: -10 })) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'A' },
      { id: 'id-b', text: 'B' },
    ]);

    expect(result.templateConfidence).toBe(0);
  });

  // ── Truncation ────────────────────────────────────────────────────────────

  it('truncates to 50 prompts, keeping the most recent, when input exceeds limit', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON()) as any
    );

    const prompts = Array.from({ length: 51 }, (_, i) => ({ id: `id-${i}`, text: `Prompt ${i}` }));
    await analyzeTemplateUsage(prompts);

    const userMessage: string = vi.mocked(generateCompletionWithUsage).mock.calls[0][0];
    // 50 entries → [P1]…[P50]
    expect(userMessage).toContain('[P50]');
    expect(userMessage).not.toContain('[P51]');
    // Oldest prompt (index 0) excluded; newest (index 50) included
    expect(userMessage).not.toContain('Prompt 0');
    expect(userMessage).toContain('Prompt 50');
  });

  // ── Provider / cost passthrough ───────────────────────────────────────────

  it('propagates llmProvider and llmCost from the AI response', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse(makeTemplateJSON(), 'openrouter', 0.005) as any
    );

    const result = await analyzeTemplateUsage([
      { id: 'id-a', text: 'A' },
      { id: 'id-b', text: 'B' },
    ]);

    expect(result.llmProvider).toBe('openrouter');
    expect(result.llmCost).toBe(0.005);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('throws a wrapped error when the AI call rejects', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockRejectedValue(new Error('Network timeout'));

    await expect(
      analyzeTemplateUsage([{ id: 'id-a', text: 'A' }, { id: 'id-b', text: 'B' }])
    ).rejects.toThrow('Failed to analyze template usage:');
  });

  it('throws a wrapped error when the AI returns malformed (non-JSON) content', async () => {
    const { generateCompletionWithUsage } = await import('../../ai');
    vi.mocked(generateCompletionWithUsage).mockResolvedValue(
      makeAIResponse('I cannot help with that.') as any
    );

    await expect(
      analyzeTemplateUsage([{ id: 'id-a', text: 'A' }, { id: 'id-b', text: 'B' }])
    ).rejects.toThrow('Failed to analyze template usage:');
  });
});
