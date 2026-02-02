/**
 * Prompts List API
 *
 * Fetches all task prompts for a project along with their creators.
 * Used by the prompt comparison and analysis features.
 *
 * GET /api/analysis/prompts?projectId={id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch prompts from database
    let prompts;
    try {
        prompts = await prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK'
            },
            select: {
                id: true,
                content: true,
                category: true,
                createdById: true,
                createdByEmail: true,
                createdByName: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (dbError: any) {
        console.error('Prompts API Error: Database query failed', {
            projectId,
            error: dbError.message
        });
        return NextResponse.json({
            error: 'Failed to fetch prompts from database. Please try again.'
        }, { status: 500 });
    }

    // Process user list
    try {
        // Get unique users who have created prompts
        const users = Array.from(new Set(prompts.map(p => p.createdById).filter(Boolean)))
            .map(id => {
                const prompt = prompts.find(p => p.createdById === id);
                return {
                    id: id as string,
                    name: prompt?.createdByName || prompt?.createdByEmail || 'Unknown User'
                };
            });

        console.log('Prompts API: Fetched prompts successfully', {
            projectId,
            userId: user.id,
            promptCount: prompts.length,
            userCount: users.length
        });

        return NextResponse.json({ prompts, users });
    } catch (error: any) {
        console.error('Prompts API Error: Unexpected error during processing', {
            projectId,
            error: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'An unexpected error occurred while processing prompts'
        }, { status: 500 });
    }
}
