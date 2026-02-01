import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCompletionWithUsage } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's role
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true }
        });

        const role = profile?.role || 'USER';

        const { projectId, type } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        if (type !== 'TASK' && type !== 'FEEDBACK') {
            return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
        }

        // Verify user owns the project (write operation - ownership required)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (role !== 'ADMIN' && project.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: Only project owners can generate trend analysis' }, { status: 403 });
        }

        // Fetch subsets of data to analyze
        const fetchRecords = (category: 'TOP_10' | 'BOTTOM_10') =>
            prisma.dataRecord.findMany({
                where: { projectId, type, category },
                take: 20,
                select: { content: true }
            });

        const [topData, bottomData] = await Promise.all([
            fetchRecords('TOP_10'),
            fetchRecords('BOTTOM_10'),
        ]);

        console.log(`Analyzing ${type} trends for project ${projectId}:`, {
            top: topData.length,
            bottom: bottomData.length,
        });

        if (!topData.length && !bottomData.length) {
            return NextResponse.json({ error: `No ${type.toLowerCase()} data available for analysis` }, { status: 400 });
        }

        const prompt = `
            Analyze the following ${type.toLowerCase()} dataset from a prompt engineering project.
            
            ### TOP 10% ${type}S (High Quality Examples)
            ${topData.map(t => `- ${t.content}`).join('\n')}

            ### BOTTOM 10% ${type}S (Low Quality Examples)
            ${bottomData.map(t => `- ${t.content}`).join('\n')}

            Please provide:
            1. **Qualities of Success**: What makes the Top 10% ${type.toLowerCase()}s succeed?
            2. **Common Failure Modes**: What are the repeating issues in Bottom 10% ${type.toLowerCase()}s?
            3. **Actionable Improvement**: One specific strategic recommendation to improve quality in this category.
            
            Return the analysis in a structured format with clear headings.
        `;

        const systemPrompt = `You are an expert AI ${type === 'TASK' ? 'Prompt Engineer' : 'Feedback Analyst'}. Provide concise, high-impact insights.`;

        const result = await generateCompletionWithUsage(prompt, systemPrompt);

        // Save the analysis to the project
        const updateField = type === 'TASK' ? 'lastTaskAnalysis' : 'lastFeedbackAnalysis';
        await prisma.project.update({
            where: { id: projectId },
            data: { [updateField]: result.content }
        });

        return NextResponse.json({
            analysis: result.content,
            usage: result.usage,
            provider: result.provider
        });
    } catch (error: any) {
        console.error('Trends API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
