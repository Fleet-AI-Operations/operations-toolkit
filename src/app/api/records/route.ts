import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findSimilarRecords } from '@/lib/similarity';

export const dynamic = 'force-dynamic';

type SortField = 'createdAt' | 'alignmentScore' | 'environment';
type SortOrder = 'asc' | 'desc';

interface DataRecordRow {
    id: string;
    projectId: string;
    type: string;
    category: string | null;
    source: string;
    content: string;
    metadata: Record<string, unknown> | null;
    embedding: number[];
    hasBeenReviewed: boolean;
    isCategoryCorrect: boolean | null;
    reviewedBy: string | null;
    alignmentAnalysis: string | null;
    ingestJobId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Validation constants
const VALID_TYPES = ['TASK', 'FEEDBACK'] as const;
const VALID_CATEGORIES = ['TOP_10', 'BOTTOM_10'] as const;
const VALID_SORT_FIELDS = ['createdAt', 'alignmentScore', 'environment'] as const;
const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const sortByParam = searchParams.get('sortBy');
    const sortOrderParam = searchParams.get('sortOrder');

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

    try {
        // Secure parameterization setup
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let pIdx = 1;

        if (projectId) {
            conditions.push(`"projectId" = $${pIdx++}`);
            params.push(projectId);
        }
        if (type) {
            conditions.push(`type = $${pIdx++}::"RecordType"`);
            params.push(type);
        }
        if (category) {
            conditions.push(`category = $${pIdx++}::"RecordCategory"`);
            params.push(category);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const nullsPosition = sortOrder === 'desc' ? 'NULLS LAST' : 'NULLS FIRST';

        let orderByClause: string;

        switch (sortBy) {
            case 'alignmentScore':
                // Extract numeric score from alignmentAnalysis text using regex
                orderByClause = `ORDER BY (
                    CASE WHEN "alignmentAnalysis" IS NOT NULL THEN
                        CAST(COALESCE((regexp_match("alignmentAnalysis", '(?:Alignment Score \\(0-100\\)|Score)[:\\s\\n]*(\\d+)', 'i'))[1], '0') AS INTEGER)
                    ELSE NULL END
                ) ${orderDirection} ${nullsPosition}`;
                break;
            case 'environment':
                // Sort by environment_name from metadata JSON
                orderByClause = `ORDER BY metadata->>'environment_name' ${orderDirection} ${nullsPosition}`;
                break;
            case 'createdAt':
            default:
                orderByClause = `ORDER BY "createdAt" ${orderDirection}`;
                break;
        }

        // Execute query with parameterized values
        const query = `
            SELECT id, "projectId", type, category, source, content, metadata, embedding,
                   "hasBeenReviewed", "isCategoryCorrect", "reviewedBy", "alignmentAnalysis",
                   "ingestJobId", "createdAt", "updatedAt"
            FROM data_records
            ${whereClause}
            ${orderByClause}
            OFFSET $${pIdx++} LIMIT $${pIdx++}
        `;
        params.push(skip, take);

        const records = await prisma.$queryRawUnsafe<DataRecordRow[]>(query, ...params);

        // Use Prisma for count
        const total = await prisma.dataRecord.count({
            where: {
                projectId: projectId || undefined,
                type: (type as 'TASK' | 'FEEDBACK') || undefined,
                category: (category as 'TOP_10' | 'BOTTOM_10') || undefined,
            }
        });

        return NextResponse.json({ records, total });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { action, targetId, limit } = await req.json();

        if (action === 'similarity') {
            if (!targetId) {
                return NextResponse.json({ error: 'Target ID required' }, { status: 400 });
            }
            const results = await findSimilarRecords(targetId, limit || 5);
            return NextResponse.json({ results });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
