import { generateCompletionWithUsage } from '../ai';

/**
 * Extracts JSON from various response formats:
 * - Markdown code blocks: ```json {...} ```
 * - Conversational responses: "Okay, here is... {...}"
 * - Plain JSON: {...}
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object in the text (most greedy match)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    // Find the largest valid JSON object
    let jsonStr = jsonMatch[0];

    // Try to balance braces if needed
    let openBraces = 0;
    let closeBraces = 0;
    let endIndex = 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') openBraces++;
      if (text[i] === '}') closeBraces++;

      if (openBraces > 0 && openBraces === closeBraces) {
        endIndex = i + 1;
        break;
      }
    }

    if (endIndex > 0) {
      const startIndex = text.indexOf('{');
      jsonStr = text.substring(startIndex, endIndex);
    }

    return jsonStr;
  }

  // If no JSON found, throw an error with the actual response
  throw new Error(`No JSON found in response. Response starts with: "${text.substring(0, 100)}..."`);
}

export interface PromptAuthenticityAnalysis {
  promptId: string;
  promptText: string;
  isLikelyNonNative: boolean;
  nonNativeConfidence: number;
  nonNativeIndicators: string[];
  isLikelyAIGenerated: boolean;
  aiGeneratedConfidence: number;
  aiGeneratedIndicators: string[];
  isLikelyTemplated: boolean;
  templateConfidence: number;
  templateIndicators: string[];
  /**
   * The inferred template pattern, or `null` if template analysis has not yet
   * been run. Template fields are always `false/0/[]/null` from `analyzePromptAuthenticity`
   * and are populated by a subsequent call to `analyzeTemplateUsage`.
   */
  detectedTemplate: string | null;
  overallAssessment: string;
  recommendations: string[];
  llmModel?: string;
  llmProvider?: string;
  llmCost?: number;
}

const AUTHENTICITY_ANALYSIS_PROMPT = `You are an expert linguistic analyst and AI content detector.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no explanations, no text before or after. Start your response with { and end with }.

Analyze the prompt for:
1. Non-Native Speaker patterns (grammar, vocabulary, sentence structure)
2. AI-Generated Content patterns (formal language, lack of personal voice, hedging phrases)

Required JSON format (example):
{
  "isLikelyNonNative": false,
  "nonNativeConfidence": 25,
  "nonNativeIndicators": ["Minor article usage variation"],
  "isLikelyAIGenerated": true,
  "aiGeneratedConfidence": 85,
  "aiGeneratedIndicators": ["Overly formal tone", "Hedging language: 'it's important to note'"],
  "overallAssessment": "Likely AI-generated with professional editing",
  "recommendations": ["Add natural speech patterns", "Include specific personal details"]
}

Respond ONLY with JSON matching this exact structure.`;

// Maximum number of prompts to include in a single template analysis call
const MAX_PROMPTS_FOR_TEMPLATE_ANALYSIS = 50;

const TEMPLATE_USAGE_PROMPT = `You are an expert at detecting templated writing patterns across a set of prompts.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no explanations, no text before or after. Start your response with { and end with }.

You will be given a numbered list of prompts all written by the same person in the same project environment.
Your task: Determine whether this person likely used a fill-in-the-blank template across their prompts, rather than writing each one independently from scratch.

Look for:
- A repeated structural skeleton across multiple prompts (same opening formula, same slot positions, same closing pattern)
- Interchangeable "slots" where only the topic/type/subject varies but the surrounding structure stays identical
- Suspiciously consistent formatting that suggests a template was copied and filled in each time
- Systematic variation — where only one or two elements change between prompts while everything else stays fixed

Note: A single prompt that uses a common phrasing is NOT evidence of a template — you need to see the SAME structure repeated across MULTIPLE prompts.

Required JSON format (example):
{
  "isLikelyTemplated": true,
  "templateConfidence": 82,
  "templateIndicators": ["Same opening 'Write a [type] about' used in 8/10 prompts", "Only topic slot varies across prompts", "Identical closing requirements throughout"],
  "detectedTemplate": "Write a [type] about [topic] that includes [requirement] and ends with [conclusion]",
  "matchingPromptNumbers": [1, 2, 3, 5, 7],
  "overallAssessment": "Strong evidence of template use — 5 of 7 prompts follow an identical structural pattern"
}

Respond ONLY with JSON matching this exact structure.`;

export async function analyzePromptAuthenticity(
  promptId: string,
  promptText: string,
  options?: { silent?: boolean }
): Promise<PromptAuthenticityAnalysis> {
  if (!promptText || promptText.trim().length === 0) {
    throw new Error('Prompt text cannot be empty');
  }

  const userMessage = `Analyze this prompt for non-native speaker patterns and AI-generated content:\n\n"${promptText}"`;

  try {
    const response = await generateCompletionWithUsage(
      userMessage,
      AUTHENTICITY_ANALYSIS_PROMPT,
      { silent: options?.silent || false }
    );

    // Extract JSON from response (handles markdown code blocks and conversational text)
    const jsonText = extractJSON(response.content);

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(`[Authenticity Checker] JSON parse error for prompt ${promptId}`);
      console.error('Raw response:', response.content);
      console.error('Extracted JSON:', jsonText);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }

    return {
      promptId,
      promptText,
      isLikelyNonNative: analysis.isLikelyNonNative || false,
      nonNativeConfidence: analysis.nonNativeConfidence || 0,
      nonNativeIndicators: analysis.nonNativeIndicators || [],
      isLikelyAIGenerated: analysis.isLikelyAIGenerated || false,
      aiGeneratedConfidence: analysis.aiGeneratedConfidence || 0,
      aiGeneratedIndicators: analysis.aiGeneratedIndicators || [],
      // Template fields are populated by analyzeTemplateUsage (cross-prompt analysis)
      isLikelyTemplated: false,
      templateConfidence: 0,
      templateIndicators: [],
      detectedTemplate: null,
      overallAssessment: analysis.overallAssessment || '',
      recommendations: analysis.recommendations || [],
      llmModel: undefined, // Not returned by generateCompletionWithUsage
      llmProvider: response.provider,
      llmCost: response.usage?.cost,
    };
  } catch (error) {
    console.error(`[Authenticity Checker] Error analyzing prompt ${promptId}:`, error);
    throw new Error(`Failed to analyze prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface TemplateUsageAnalysis {
  isLikelyTemplated: boolean;
  templateConfidence: number;
  templateIndicators: string[];
  detectedTemplate: string | null;
  /** IDs from the input `prompts` array that match the detected template */
  matchingPromptIds: string[];
  overallAssessment: string;
  llmProvider?: string;
  llmCost?: number;
}

/**
 * Analyzes a set of prompts from the same user+environment to determine whether
 * the user likely used a fill-in-the-blank template across their submissions.
 *
 * Unlike `analyzePromptAuthenticity`, this is a cross-prompt comparison — it
 * looks for a shared structural skeleton repeated across multiple prompts, not
 * whether any single prompt looks "templated" in isolation.
 */
export async function analyzeTemplateUsage(
  prompts: Array<{ id: string; text: string }>,
  options?: { silent?: boolean }
): Promise<TemplateUsageAnalysis> {
  if (prompts.length < 2) {
    console.warn('[Template Usage] analyzeTemplateUsage called with fewer than 2 prompts — skipping.');
    return {
      isLikelyTemplated: false,
      templateConfidence: 0,
      templateIndicators: [],
      detectedTemplate: null,
      matchingPromptIds: [],
      overallAssessment: 'Not enough prompts to determine template usage.',
    };
  }

  // Use the most recent prompts if the set is very large
  const promptsToAnalyze = prompts.slice(-MAX_PROMPTS_FOR_TEMPLATE_ANALYSIS);

  const promptList = promptsToAnalyze
    .map((p, i) => `[P${i + 1}] ${p.text}`)
    .join('\n\n');

  const userMessage = `Analyze these ${promptsToAnalyze.length} prompts written by the same user in the same project environment for template usage:\n\n${promptList}`;

  try {
    const response = await generateCompletionWithUsage(
      userMessage,
      TEMPLATE_USAGE_PROMPT,
      { silent: options?.silent || false }
    );

    const jsonText = extractJSON(response.content);

    let analysis;
    try {
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Template Usage] JSON parse error');
      console.error('Raw response:', response.content);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }

    // Map 1-indexed prompt numbers back to their IDs
    const matchingNumbers: number[] = analysis.matchingPromptNumbers || [];
    const matchingPromptIds = matchingNumbers
      .filter((n) => n >= 1 && n <= promptsToAnalyze.length)
      .map((n) => promptsToAnalyze[n - 1].id);

    const isLikelyTemplated = (analysis.isLikelyTemplated || false) && matchingPromptIds.length > 0;

    return {
      isLikelyTemplated,
      templateConfidence: Math.min(100, Math.max(0, analysis.templateConfidence ?? 0)),
      templateIndicators: analysis.templateIndicators || [],
      detectedTemplate: analysis.detectedTemplate || null,
      matchingPromptIds,
      overallAssessment: analysis.overallAssessment || '',
      llmProvider: response.provider,
      llmCost: response.usage?.cost,
    };
  } catch (error) {
    console.error('[Template Usage] Error analyzing template usage:', error);
    throw new Error(`Failed to analyze template usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function analyzeBatchPrompts(
  prompts: Array<{ id: string; text: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<PromptAuthenticityAnalysis[]> {
  const results: PromptAuthenticityAnalysis[] = [];

  for (let i = 0; i < prompts.length; i++) {
    try {
      const result = await analyzePromptAuthenticity(prompts[i].id, prompts[i].text);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, prompts.length);
      }
    } catch (error) {
      console.error(`[Batch Analysis] Error analyzing prompt ${prompts[i].id}:`, error);
      // Skip failed prompts rather than pushing fabricated confidence values
    }
  }

  return results;
}
