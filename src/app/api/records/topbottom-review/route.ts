import { NextRequest, NextResponse } from 'next/server';
import { RecordCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

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
        const category = searchParams.get('category') as RecordCategory | null;
        const includeReviewed = searchParams.get('includeReviewed') === 'true';

        if (!projectId || projectId.trim() === "" || projectId === "undefined") {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        // Verify project exists (read access allowed for all users)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const whereClause: any = {
            projectId,
            category: {
                in: ['TOP_10', 'BOTTOM_10']
            }
        };

        // Only filter by review status if not including reviewed records
        if (!includeReviewed) {
            whereClause.hasBeenReviewed = false;
        }

        if (category === 'TOP_10' || category === 'BOTTOM_10') {
            whereClause.category = category;
        }

        const records = await prisma.dataRecord.findMany({
            where: whereClause,
            select: {
                id: true,
                content: true,
                category: true,
                source: true,
                metadata: true,
                alignmentAnalysis: true,
                isCategoryCorrect: true,
                hasBeenReviewed: true,
                reviewedBy: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ records, total: records.length });
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch records' },
            { status: 500 }
        );
    }
}
