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
  detectedTemplate: string;
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
3. Templated Prompt patterns (fixed structural formulas, placeholder-like language, repetitive framing, fill-in-the-blank structure, e.g. "Write a [X] about [Y] that [Z]")

Required JSON format (example):
{
  "isLikelyNonNative": false,
  "nonNativeConfidence": 25,
  "nonNativeIndicators": ["Minor article usage variation"],
  "isLikelyAIGenerated": true,
  "aiGeneratedConfidence": 85,
  "aiGeneratedIndicators": ["Overly formal tone", "Hedging language: 'it's important to note'"],
  "isLikelyTemplated": true,
  "templateConfidence": 78,
  "templateIndicators": ["Fixed opening formula: 'Write a [type] about'", "Interchangeable slot structure", "No personal specificity"],
  "detectedTemplate": "Write a [type] about [topic] that includes [requirements]",
  "overallAssessment": "Likely AI-generated with professional editing",
  "recommendations": ["Add natural speech patterns", "Include specific personal details"]
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
      isLikelyTemplated: analysis.isLikelyTemplated || false,
      templateConfidence: analysis.templateConfidence || 0,
      templateIndicators: analysis.templateIndicators || [],
      detectedTemplate: analysis.detectedTemplate || '',
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
