/**
 * Alignment Analysis Engine
 *
 * Generates AI-powered alignment scores for tasks/feedback against project guidelines.
 * Uses RAG (Retrieval-Augmented Generation) approach:
 * 1. Extracts text from project guidelines PDF
 * 2. Sends guidelines + content to LLM for evaluation
 * 3. Caches results to avoid redundant AI calls
 *
 * POST /api/analysis/compare
 * Body: { recordId: string, forceRegenerate?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { generateCompletionWithUsage } from '@repo/core/ai';
import { extractTextFromPDF } from '@repo/core/utils';
import { createClient } from '@repo/auth/server';

// Module-level cache — persists across requests in the same server process.
// Key: guideline.id, Value: { text, expiresAt }.
// TTL: 30 minutes. Without a TTL, re-uploading a PDF (same guideline ID, new content)
// would serve stale extracted text until the server process restarted.
const GUIDELINE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedGuideline {
    text: string;
    expiresAt: number;
}

const guidelineTextCache = new Map<string, CachedGuideline>();

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let recordId: string;
    let forceRegenerate: boolean;
    let guidelineId: string | undefined;
    try {
        const body = await req.json();
        recordId = body.recordId;
        forceRegenerate = body.forceRegenerate;
        guidelineId = body.guidelineId;
    } catch (parseError: any) {
        console.error('Compare API Error: Invalid request body', {
            error: parseError.message
        });
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!recordId) {
        return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // Fetch record from database
    let record;
    try {
        record = await prisma.dataRecord.findUnique({
            where: { id: recordId },
        });
    } catch (dbError: any) {
        console.error('Compare API Error: Database query failed', {
            recordId,
            error: dbError.message
        });
        return NextResponse.json({
            error: 'Database error. Please try again or contact support if the issue persists.'
        }, { status: 500 });
    }

    if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    try {

        // Verify user has appropriate permissions (CORE role and above can generate alignment analysis)
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });
        const role = profile?.role || 'USER';

        const allowedRoles = ['CORE', 'FLEET', 'MANAGER', 'ADMIN'];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({
                error: 'Forbidden: Insufficient permissions to generate alignment analysis'
            }, { status: 403 });
        }

        // Return cached analysis if available and not forcing regeneration.
        // Skip cache when a specific guidelineId is provided — the user explicitly
        // selected a guideline and expects a fresh analysis against it.
        if (record.alignmentAnalysis && !forceRegenerate && !guidelineId) {
            console.log('Compare API: Returned cached alignment analysis', {
                recordId: record.id,
                environment: record.environment,
                userId: user.id,
                cached: true
            });
            return NextResponse.json({
                recordType: record.type,
                recordContent: record.content,
                metadata: record.metadata,
                evaluation: record.alignmentAnalysis
            });
        }

        // Look up the guideline — use the explicitly selected one if provided,
        // otherwise fall back to environment-specific or global.
        const guideline = guidelineId
            ? await prisma.guideline.findUnique({ where: { id: guidelineId } })
            : await prisma.guideline.findFirst({
                where: {
                    OR: [
                        { environments: { has: record.environment } },
                        { environments: { isEmpty: true } }
                    ]
                },
                orderBy: { createdAt: 'desc' }
            });

        if (!guideline) {
            return NextResponse.json({ error: 'No guidelines found for this environment. Please upload guidelines in the Fleet app.' }, { status: 400 });
        }

        // When a specific guideline was requested, verify it applies to this record's environment.
        // Global guidelines (empty environments array) apply to all environments.
        if (guidelineId) {
            const isGlobal = guideline.environments.length === 0;
            const appliesToEnvironment = guideline.environments.includes(record.environment);
            if (!isGlobal && !appliesToEnvironment) {
                return NextResponse.json({
                    error: 'The selected guideline does not apply to this record\'s environment.'
                }, { status: 400 });
            }
        }

        // Parse PDF guidelines (with in-process cache to avoid re-parsing on every request)
        const now = Date.now();
        const cachedGuideline = guidelineTextCache.get(guideline.id);
        let guidelinesText = (cachedGuideline && cachedGuideline.expiresAt > now) ? cachedGuideline.text : '';

        if (!guidelinesText) {
            const base64Data = guideline.content.split(';base64,').pop() || guideline.content;

            if (!base64Data) {
                console.error('Compare API Error: Guidelines data is not in expected base64 format', {
                    environment: record.environment,
                    recordId: record.id
                });
                return NextResponse.json({
                    error: 'Project guidelines are corrupted. Please re-upload the guidelines PDF in Project Management.'
                }, { status: 400 });
            }

            try {
                const buffer = Buffer.from(base64Data, 'base64');
                const parsed = await extractTextFromPDF(buffer);
                guidelinesText = parsed.text;

                if (!guidelinesText || guidelinesText.trim().length === 0) {
                    console.error('Compare API Error: PDF parsed successfully but contains no text content', {
                        environment: record.environment,
                        recordId: record.id
                    });
                    return NextResponse.json({
                        error: 'The guidelines PDF appears to be empty or contains only images. Please upload a PDF with extractable text.'
                    }, { status: 400 });
                }

                guidelineTextCache.set(guideline.id, { text: guidelinesText, expiresAt: now + GUIDELINE_CACHE_TTL_MS });
            } catch (pdfError: any) {
                console.error('Compare API Error: PDF parsing failed', {
                    environment: record.environment,
                    recordId: record.id,
                    error: pdfError.message,
                    stack: pdfError.stack
                });
                return NextResponse.json({
                    error: `Could not parse guidelines PDF: ${pdfError.message}. Please verify the PDF is not corrupted and try re-uploading.`
                }, { status: 400 });
            }
        }

        const systemPrompt = `You are an expert AI Alignment Lead and Quality Assurance Analyst for the ${record.environment} environment.`;
        const prompt = `
            Evaluate the following ${record.type === 'TASK' ? 'prompt' : 'feedback'} against the provided project guidelines.

            ### PROJECT GUIDELINES
            ${guidelinesText}

            ### CONTENT TO EVALUATE
            ${record.content}

            Please provide:
            1. **Guideline Alignment Score (0-100)**: How well does this follow the guidelines?
            2. **Detailed Analysis**: A breakdown of which guidelines were followed and which were missed.
            3. **Suggested Improvements**: How could this be modified to better align with the guidelines?

            Return the evaluation in a structured format with clear headings.
        `;

        // Generate AI evaluation
        let result;
        try {
            result = await generateCompletionWithUsage(prompt, systemPrompt);
        } catch (aiError: any) {
            console.error('Compare API Error: AI service failed', {
                environment: record.environment,
                recordId: record.id,
                error: aiError.message,
                stack: aiError.stack
            });
            return NextResponse.json({
                error: `AI service error: ${aiError.message}. Please try again or check AI service configuration.`
            }, { status: 500 });
        }

        // Save analysis to record only when using the default guideline lookup.
        // When a specific guidelineId is provided, skip saving to avoid overwriting
        // the stored default analysis with a one-off comparison result.
        if (!guidelineId) {
            try {
                await prisma.dataRecord.update({
                    where: { id: record.id },
                    data: { alignmentAnalysis: result.content }
                });
            } catch (updateError: any) {
                console.error('Compare API Error: Failed to save analysis to database', {
                    environment: record.environment,
                    recordId: record.id,
                    error: updateError.message
                });
            }
        }

        // Log successful operation
        console.log('Compare API: Alignment analysis generated', {
            recordId: record.id,
            environment: record.environment,
            userId: user.id,
            wasRegenerated: forceRegenerate,
            cached: false,
            provider: result.provider,
            tokensUsed: result.usage?.totalTokens,
            cost: result.usage?.cost
        });

        return NextResponse.json({
            recordType: record.type,
            recordContent: record.content,
            metadata: record.metadata,
            evaluation: result.content,
            usage: result.usage,
            provider: result.provider
        });

    } catch (error: any) {
        console.error('Compare API Error: Unexpected error', {
            recordId,
            error: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'An unexpected error occurred. Please try again or contact support if the issue persists.'
        }, { status: 500 });
    }
}
