import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TaskMetadata {
    task_key?: string;
    [key: string]: unknown;
}

interface FeedbackMetadata {
    task_key?: string;
    is_positive?: boolean | string;
    feedback_id?: string;
    prompt_quality_rating?: number;
    rejection_reason?: string;
    [key: string]: unknown;
}

interface FeedbackStats {
    userId: string;
    userEmail: string;
    userName: string | null;
    submittedCount: number;
    acceptedCount: number;
    deniedCount: number;
}

async function getUserStats(projectId: string) {
    // Fetch all tasks and feedback in one go
    const [taskRecords, feedbackRecords] = await Promise.all([
        prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'TASK',
            },
            select: {
                metadata: true,
                createdById: true,
                createdByEmail: true,
                createdByName: true,
            },
        }),
        prisma.dataRecord.findMany({
            where: {
                projectId,
                type: 'FEEDBACK',
            },
            select: {
                metadata: true,
            },
        }),
    ]);

    // Build user stats from tasks and feedback
    const userStatsMap = new Map<string, FeedbackStats>();
    const taskKeyToUserId = new Map<string, string>();

    // Count tasks per user
    taskRecords.forEach((task) => {
        const metadata = task.metadata as TaskMetadata;
        const taskKey = metadata?.task_key;
        const userId = task.createdById;

        if (!userId || !taskKey) {
            return;
        }

        if (!userStatsMap.has(userId)) {
            userStatsMap.set(userId, {
                userId,
                userEmail: task.createdByEmail || '',
                userName: task.createdByName || null,
                submittedCount: 0,
                acceptedCount: 0,
                deniedCount: 0,
            });
        }

        userStatsMap.get(userId)!.submittedCount += 1;
        taskKeyToUserId.set(taskKey, userId);
    });

    // Count feedback per user
    feedbackRecords.forEach((fb) => {
        const metadata = fb.metadata as FeedbackMetadata;
        const taskKey = metadata?.task_key;
        const isPositive = metadata?.is_positive;

        if (!taskKey) {
            return;
        }

        const userId = taskKeyToUserId.get(taskKey);
        if (!userId) {
            return;
        }

        const stats = userStatsMap.get(userId);
        if (!stats) {
            return;
        }

        if (isPositive === true || isPositive === 'true') {
            stats.acceptedCount += 1;
        } else if (isPositive === false || isPositive === 'false') {
            stats.deniedCount += 1;
        }
    });

    return Array.from(userStatsMap.values());
}

async function getUserFeedbackDetails(projectId: string, userId: string) {
    // Fetch all tasks for this user
    const taskRecords = await prisma.dataRecord.findMany({
        where: {
            projectId,
            type: 'TASK',
            createdById: userId,
        },
        select: {
            id: true,
            content: true,
            metadata: true,
            createdAt: true,
        },
    });

    // Build map of task keys for this user
    const taskKeySet = new Set<string>();
    taskRecords.forEach((task) => {
        const metadata = task.metadata as TaskMetadata;
        const taskKey = metadata?.task_key;
        if (taskKey) taskKeySet.add(taskKey);
    });

    // If no tasks, return empty array early
    if (taskKeySet.size === 0) {
        return [];
    }

    // Fetch only feedback related to this user's tasks using raw query for JSON filtering
    const taskKeysArray = Array.from(taskKeySet);
    const allFeedback = await prisma.$queryRaw<Array<{
        id: string;
        metadata: unknown;
        content: string;
        createdAt: Date;
    }>>`
        SELECT id, metadata, content, "createdAt"
        FROM data_records
        WHERE "projectId" = ${projectId}
          AND type = 'FEEDBACK'
          AND metadata->>'task_key' = ANY(${taskKeysArray})
    `;

    // Return tasks with feedback filtered by task_key
    return taskRecords.map((task) => {
        const taskMetadata = task.metadata as TaskMetadata;
        const taskKey = taskMetadata?.task_key;

        // Get feedback for this task
        const taskFeedback = allFeedback
            .filter((fb) => {
                const fbMetadata = fb.metadata as FeedbackMetadata;
                return fbMetadata?.task_key === taskKey;
            })
            .map((fb) => {
                const fbMetadata = fb.metadata as FeedbackMetadata;
                return {
                    id: fb.id,
                    feedbackContent: fb.content,
                    isPositive: fbMetadata?.is_positive === true || fbMetadata?.is_positive === 'true' ? 1 : 0,
                    feedbackId: fbMetadata?.feedback_id || null,
                    promptQualityRating: fbMetadata?.prompt_quality_rating || null,
                    rejectionReason: fbMetadata?.rejection_reason || null,
                    createdAt: fb.createdAt,
                };
            });

        return {
            id: task.id,
            content: task.content,
            taskKey: taskKey,
            createdAt: task.createdAt,
            feedback: taskFeedback,
        };
    });
}

async function getCandidateStatus(projectId: string, userId: string) {
    const status = await prisma.candidateStatus.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId,
            },
        },
        select: {
            status: true,
            userId: true,
            email: true,
            updatedAt: true,
        },
    });

    return {
        status: status?.status || null,
        userId,
        email: status?.email || null,
        updatedAt: status?.updatedAt || null,
    };
}

/**
 * GET /api/candidates
 * Query params:
 * - projectId: string (required)
 * - userId: string (optional) - if provided with action=details, returns feedback details
 * - action: string (optional) - 'details' for feedback details, 'status' for candidate status, 'all-statuses' for all statuses in project
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const userId = searchParams.get('userId');
        const action = searchParams.get('action') || 'stats';

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // Require FLEET role or higher (FLEET, ADMIN)
        const authResult = await requireRole('FLEET');
        if ('error' in authResult) return authResult.error;
        const { user } = authResult;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Handle all-statuses action - returns all candidate statuses for the project
        if (action === 'all-statuses') {
            const statuses = await prisma.candidateStatus.findMany({
                where: { projectId },
                select: {
                    userId: true,
                    status: true,
                },
            });
            return NextResponse.json({ statuses });
        }

        // Handle different action types
        if (action === 'status') {
            if (!userId) {
                return NextResponse.json(
                    { error: 'userId is required for status action' },
                    { status: 400 }
                );
            }
            const status = await getCandidateStatus(projectId, userId);
            return NextResponse.json(status);
        }

        if (action === 'details') {
            if (!userId) {
                return NextResponse.json(
                    { error: 'userId is required for details action' },
                    { status: 400 }
                );
            }
            const tasks = await getUserFeedbackDetails(projectId, userId);
            return NextResponse.json({ tasks });
        }

        // Default: return stats for all users
        const userStats = await getUserStats(projectId);
        return NextResponse.json({ userStats });
    } catch (error) {
        console.error('GET /api/candidates error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Failed to fetch candidates', details: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * POST /api/candidates
 * Create or update candidate status
 * 
 * Body:
 * - userId: string (required)
 * - projectId: string (required)
 * - status: 'ACCEPTED' | 'REJECTED' (required)
 * - email: string (optional, used for upsert)
 */
export async function POST(req: NextRequest) {
    try {
        // Require FLEET role or higher (FLEET, ADMIN)
        const authResult = await requireRole('FLEET');
        if ('error' in authResult) return authResult.error;
        const { user } = authResult;

        const body = await req.json();
        const { userId, projectId, status, email } = body;

        if (!userId || !projectId || !status) {
            return NextResponse.json(
                { error: 'userId, projectId, and status are required' },
                { status: 400 }
            );
        }

        if (!['ACCEPTED', 'REJECTED'].includes(status)) {
            return NextResponse.json(
                { error: "status must be 'ACCEPTED' or 'REJECTED'" },
                { status: 400 }
            );
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, ownerId: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const candidateStatus = await prisma.candidateStatus.upsert({
            where: {
                userId_projectId: {
                    userId,
                    projectId,
                },
            },
            update: {
                status,
                email: email || '',
                updatedAt: new Date(),
            },
            create: {
                userId,
                projectId,
                status,
                email: email || '',
            },
        });

        return NextResponse.json({
            status: candidateStatus.status,
            userId: candidateStatus.userId,
            email: candidateStatus.email,
            updatedAt: candidateStatus.updatedAt,
        });
    } catch (error) {
        console.error('POST /api/candidates error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Internal server error', details: errorMessage },
            { status: 500 }
        );
    }
}
