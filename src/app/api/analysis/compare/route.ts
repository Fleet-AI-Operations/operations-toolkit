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
import { prisma } from '@/lib/prisma';
import { generateCompletionWithUsage } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
// @ts-expect-error - pdf-parse lacks modern TS definitions but is the most stable for Node PDF scraping
import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let recordId: string;
    let forceRegenerate: boolean;
    try {
        const body = await req.json();
        recordId = body.recordId;
        forceRegenerate = body.forceRegenerate;
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
            include: { project: true }
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

        // Verify user owns the project (write operation - ownership required)
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });
        const role = profile?.role || 'USER';

        if (role !== 'ADMIN' && record.project.ownerId !== user.id) {
            return NextResponse.json({
                error: 'Forbidden: Only project owners can generate alignment analysis'
            }, { status: 403 });
        }

        // Return cached analysis if available and not forcing regeneration
        if (record.alignmentAnalysis && !forceRegenerate) {
            console.log('Compare API: Returned cached alignment analysis', {
                recordId: record.id,
                projectId: record.projectId,
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

        const project = record.project;
        if (!project.guidelines) {
            return NextResponse.json({ error: 'Project guidelines not found. Please upload them in Project Management.' }, { status: 400 });
        }

        // Parse PDF guidelines
        let guidelinesText = '';
        const base64Data = project.guidelines.split(';base64,').pop();

        if (!base64Data) {
            console.error('Compare API Error: Guidelines data is not in expected base64 format', {
                projectId: record.projectId,
                recordId: record.id
            });
            return NextResponse.json({
                error: 'Project guidelines are corrupted. Please re-upload the guidelines PDF in Project Management.'
            }, { status: 400 });
        }

        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const parsed = await pdf(buffer);
            guidelinesText = parsed.text;

            if (!guidelinesText || guidelinesText.trim().length === 0) {
                console.error('Compare API Error: PDF parsed successfully but contains no text content', {
                    projectId: record.projectId,
                    recordId: record.id
                });
                return NextResponse.json({
                    error: 'The guidelines PDF appears to be empty or contains only images. Please upload a PDF with extractable text.'
                }, { status: 400 });
            }
        } catch (pdfError: any) {
            console.error('Compare API Error: PDF parsing failed', {
                projectId: record.projectId,
                recordId: record.id,
                error: pdfError.message,
                stack: pdfError.stack
            });
            return NextResponse.json({
                error: `Could not parse guidelines PDF: ${pdfError.message}. Please verify the PDF is not corrupted and try re-uploading.`
            }, { status: 400 });
        }

        const systemPrompt = `You are an expert AI Alignment Lead and Quality Assurance Analyst for the ${project.name} project.`;
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
                projectId: record.projectId,
                recordId: record.id,
                error: aiError.message,
                stack: aiError.stack
            });
            return NextResponse.json({
                error: `AI service error: ${aiError.message}. Please try again or check AI service configuration.`
            }, { status: 500 });
        }

        // Save analysis to record
        try {
            await prisma.dataRecord.update({
                where: { id: record.id },
                data: { alignmentAnalysis: result.content }
            });
        } catch (updateError: any) {
            console.error('Compare API Error: Failed to save analysis to database', {
                projectId: record.projectId,
                recordId: record.id,
                error: updateError.message
            });
            // Return the result anyway since the analysis was generated successfully
            console.warn('Returning analysis despite database save failure');
        }

        // Log successful operation
        console.log('Compare API: Alignment analysis generated', {
            recordId: record.id,
            projectId: record.projectId,
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
