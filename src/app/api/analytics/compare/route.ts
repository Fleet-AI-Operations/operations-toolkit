/**
 * ALIGNMENT ANALYSIS ENGINE
 * This endpoint performs RAG-like (Retrieval-Augmented Generation) grounding
 * by extracting text from a project's Guidelines PDF and comparing it 
 * against a specific DataRecord using an LLM.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCompletionWithUsage } from '@/lib/ai';
// @ts-ignore - pdf-parse lacks modern TS definitions but is the most stable for Node PDF scraping.
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { recordId, forceRegenerate } = await req.json();

        if (!recordId) {
            return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
        }

        // 1. DATA RETRIEVAL: Fetch the record and its parent project's guidelines.
        const record = await prisma.dataRecord.findUnique({
            where: { id: recordId },
            include: { project: true }
        });

        if (!record) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        // OPTIMIZATION: Return cached analysis if available to save LLM tokens.
        if (record.alignmentAnalysis && !forceRegenerate) {
            return NextResponse.json({
                evaluation: record.alignmentAnalysis,
                recordContent: record.content,
                projectName: record.project.name,
                recordType: record.type,
                metadata: record.metadata
            });
        }

        const { guidelines, name: projectName } = record.project;

        if (!guidelines) {
            return NextResponse.json({ error: 'No guidelines uploaded for this project.' }, { status: 400 });
        }

        // 2. PDF SCRAPING: Guidelines are stored as Base64 strings in the DB.
        // We convert to a Buffer and parse the raw text.
        let guidelinesText = '';
        try {
            const base64Data = guidelines.split(';base64,').pop();

            if (base64Data) {
                const buffer = Buffer.from(base64Data, 'base64');
                const data = await pdf(buffer);
                guidelinesText = data.text;
            }
        } catch (err: any) {
            console.error('PDF Extraction Error:', err);
            return NextResponse.json({
                error: `Failed to extract text from guidelines PDF: ${err.message}`,
                details: err.stack
            }, { status: 500 });
        }

        if (!guidelinesText) {
            return NextResponse.json({ error: 'Guidelines PDF appears to be empty or unreadable.' }, { status: 400 });
        }

        // 3. AI EVALUATE: Construct the prompt with project context.
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

        const systemPrompt = `You are an expert AI Alignment Lead and Quality Assurance Analyst for the ${projectName} project.`;

        // CALL LLM
        const result = await generateCompletionWithUsage(prompt, systemPrompt);

        // 4. PERSISTENCE: Save the result back to the record for future fast-loads.
        await prisma.dataRecord.update({
            where: { id: recordId },
            data: { alignmentAnalysis: result.content }
        });

        return NextResponse.json({
            evaluation: result.content,
            recordContent: record.content,
            projectName,
            recordType: record.type,
            metadata: record.metadata,
            usage: result.usage,
            provider: result.provider
        });
    } catch (error: any) {
        console.error('Comparison API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
