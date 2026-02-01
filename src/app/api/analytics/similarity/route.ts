import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cosineSimilarity } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const threshold = parseFloat(searchParams.get('threshold') || '0.7');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Verify project exists (read access allowed for all users)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        // Fetch all Tasks and Feedback for the project
        const tasks = await prisma.dataRecord.findMany({
            where: { projectId, type: 'TASK' },
        });

        const feedbacks = await prisma.dataRecord.findMany({
            where: { projectId, type: 'FEEDBACK' },
        });

        const taskEmbeds = tasks.filter(t => t.embedding && t.embedding.length > 0);
        const feedbackEmbeds = feedbacks.filter(f => f.embedding && f.embedding.length > 0);

        if (taskEmbeds.length === 0 || feedbackEmbeds.length === 0) {
            return NextResponse.json({ matches: [], message: 'Insufficient data for cross-analysis' });
        }

        const matches: any[] = [];

        // Cross-compare every task with every feedback
        // Note: For very large datasets, this O(N*M) is slow.
        for (const task of taskEmbeds) {
            for (const feedback of feedbackEmbeds) {
                const sim = await cosineSimilarity(task.embedding as number[], feedback.embedding as number[]);
                if (sim >= threshold) {
                    matches.push({
                        task: {
                            id: task.id,
                            content: task.content,
                            category: task.category,
                            score: (task.metadata as any)?.avg_score
                        },
                        feedback: {
                            id: feedback.id,
                            content: feedback.content,
                            category: feedback.category
                        },
                        similarity: sim
                    });
                }
            }
        }

        // Sort by highest similarity and limit
        const sortedMatches = matches
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return NextResponse.json({ matches: sortedMatches });
    } catch (error: any) {
        console.error('Analytics API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
