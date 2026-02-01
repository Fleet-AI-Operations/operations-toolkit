import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findSimilarRecords } from '@/lib/similarity';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Valid enum values matching Prisma schema
const VALID_TYPES = ['TASK', 'FEEDBACK'] as const;
const VALID_CATEGORIES = ['TOP_10', 'BOTTOM_10'] as const;
const VALID_SORT_FIELDS = ['createdAt', 'alignmentScore', 'environment'] as const;
const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

type SortField = typeof VALID_SORT_FIELDS[number];
type SortOrder = typeof VALID_SORT_ORDERS[number];

interface DataRecordRow {
    id: string;
    projectId: string;
    type: string;
    category: string;
    source: string;
    content: string;
    metadata: Record<string, unknown> | null;
    embedding: number[] | null;
    hasBeenReviewed: boolean;
    isCategoryCorrect: boolean | null;
    reviewedBy: string | null;
    alignmentAnalysis: string | null;
    ingestJobId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

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
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const sortByParam = searchParams.get('sortBy');
        const sortOrderParam = searchParams.get('sortOrder');

        // Validate project exists if projectId is specified (read access allowed for all users)
        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                select: { id: true }
            });

            if (!project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }
        }

        // Validate and parse pagination params (default to safe values if invalid)
        const skipParsed = parseInt(searchParams.get('skip') || '0');
        const takeParsed = parseInt(searchParams.get('take') || '50');
        const skip = isNaN(skipParsed) || skipParsed < 0 ? 0 : skipParsed;
        const take = isNaN(takeParsed) || takeParsed < 1 ? 50 : Math.min(takeParsed, 100);

        // Validate enum values
        if (type && !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
        }
        if (category && !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
            return NextResponse.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
        }

        // Validate sort params (default to safe values if invalid)
        const sortBy: SortField = sortByParam && VALID_SORT_FIELDS.includes(sortByParam as SortField)
            ? sortByParam as SortField
            : 'createdAt';
        const sortOrder: SortOrder = sortOrderParam && VALID_SORT_ORDERS.includes(sortOrderParam as SortOrder)
            ? sortOrderParam as SortOrder
            : 'desc';

        // Build WHERE clause conditions with proper parameterization
        const whereConditions: Prisma.Sql[] = [];

        if (projectId) {
            whereConditions.push(Prisma.sql`"projectId" = ${projectId}`);
        }
        if (type) {
            whereConditions.push(Prisma.sql`type = ${type}::"RecordType"`);
        }
        if (category) {
            whereConditions.push(Prisma.sql`category = ${category}::"RecordCategory"`);
        }

        const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const nullsPosition = sortOrder === 'desc' ? 'NULLS LAST' : 'NULLS FIRST';

        // Build ORDER BY clause based on validated sortBy
        let orderByClause: Prisma.Sql;

        switch (sortBy) {
            case 'alignmentScore':
                // Extract numeric score from alignmentAnalysis text using regex
                orderByClause = Prisma.sql`ORDER BY (
                    CASE WHEN "alignmentAnalysis" IS NOT NULL THEN
                        CAST(COALESCE((regexp_match("alignmentAnalysis", '(?:Alignment Score \\(0-100\\)|Score)[:\\s\\n]*(\\d+)', 'i'))[1], '0') AS INTEGER)
                    ELSE NULL END
                ) ${Prisma.raw(orderDirection)} ${Prisma.raw(nullsPosition)}`;
                break;
            case 'environment':
                // Sort by environment_name from metadata JSON
                orderByClause = Prisma.sql`ORDER BY metadata->>'environment_name' ${Prisma.raw(orderDirection)} ${Prisma.raw(nullsPosition)}`;
                break;
            case 'createdAt':
            default:
                orderByClause = Prisma.sql`ORDER BY "createdAt" ${Prisma.raw(orderDirection)}`;
                break;
        }

        // Build the complete query with proper parameterization
        const whereClause = whereConditions.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
            : Prisma.empty;

        const query = Prisma.sql`
            SELECT id, "projectId", type, category, source, content, metadata, embedding,
                   "hasBeenReviewed", "isCategoryCorrect", "reviewedBy", "alignmentAnalysis",
                   "ingestJobId", "createdAt", "updatedAt"
            FROM data_records
            ${whereClause}
            ${orderByClause}
            OFFSET ${skip} LIMIT ${take}
        `;

        const records = await prisma.$queryRaw<DataRecordRow[]>(query);

        // Use Prisma for count
        const total = await prisma.dataRecord.count({
            where: {
                projectId: projectId || undefined,
                type: (type as 'TASK' | 'FEEDBACK') || undefined,
                category: (category as 'TOP_10' | 'BOTTOM_10') || undefined,
            }
        });

        return NextResponse.json({ records, total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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

        const { action, targetId, limit } = await req.json();

        if (action === 'similarity') {
            if (!targetId) {
                return NextResponse.json({ error: 'Target ID required' }, { status: 400 });
            }

            // Verify user owns the project that contains the target record
            const targetRecord = await prisma.dataRecord.findUnique({
                where: { id: targetId },
                select: {
                    projectId: true,
                    project: {
                        select: { ownerId: true }
                    }
                }
            });

            if (!targetRecord) {
                return NextResponse.json({ error: 'Record not found' }, { status: 404 });
            }

            if (role !== 'ADMIN' && targetRecord.project.ownerId !== user.id) {
                return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
            }

            const results = await findSimilarRecords(targetId, limit || 5);
            return NextResponse.json({ results });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
