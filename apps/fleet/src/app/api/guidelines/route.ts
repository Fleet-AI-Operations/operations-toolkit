import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';

/**
 * GET /api/guidelines
 * List all guidelines with optional environment filter
 * Access: FLEET+
 */
export async function GET(request: NextRequest) {
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

        // Check if user has FLEET or ADMIN role
        const allowedRoles = ['FLEET', 'MANAGER', 'ADMIN'];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const environment = searchParams.get('environment');

        // Filter by environment if specified (check if environment is in the array)
        const where = environment ? {
            environments: {
                has: environment
            }
        } : {};

        const guidelines = await prisma.guideline.findMany({
            where,
            select: {
                id: true,
                name: true,
                environments: true,
                uploadedBy: true,
                createdAt: true,
                updatedAt: true,
                users: {
                    select: {
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({ guidelines });
    } catch (error) {
        console.error('Error fetching guidelines:', error);
        return NextResponse.json(
            { error: 'Failed to fetch guidelines' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/guidelines
 * Upload new guideline PDF
 * Access: FLEET+
 */
export async function POST(request: NextRequest) {
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

        // Check if user has FLEET or ADMIN role
        const allowedRoles = ['FLEET', 'MANAGER', 'ADMIN'];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        const body = await request.json();
        const { name, content, environments } = body;

        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        if (!content) {
            return NextResponse.json(
                { error: 'PDF content is required' },
                { status: 400 }
            );
        }

        // Validate base64 PDF content
        if (!content.startsWith('data:application/pdf;base64,')) {
            return NextResponse.json(
                { error: 'Invalid PDF format. Expected base64-encoded PDF' },
                { status: 400 }
            );
        }

        const guideline = await prisma.guideline.create({
            data: {
                name: name.trim(),
                content,
                environments: environments || [],
                uploadedBy: user.id
            },
            include: {
                users: {
                    select: {
                        email: true
                    }
                }
            }
        });

        logAudit({
            action: 'GUIDELINE_CREATED',
            entityType: 'GUIDELINE',
            entityId: guideline.id,
            userId: user.id,
            userEmail: user.email ?? 'unknown',
            metadata: { name: guideline.name, environments: guideline.environments },
        }).catch(err => console.error('[Guidelines API] Audit log failed:', err));

        return NextResponse.json({ guideline }, { status: 201 });
    } catch (error) {
        console.error('Error creating guideline:', error);
        return NextResponse.json(
            { error: 'Failed to create guideline' },
            { status: 500 }
        );
    }
}
