import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { createClient } from '@repo/auth/server';
import { logAudit } from '@repo/core/audit';

// Helper function to check FLEET+ authorization
async function checkAuth() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { role: true }
    });

    const role = profile?.role || 'USER';
    const allowedRoles = ['FLEET', 'MANAGER', 'ADMIN'];

    if (!allowedRoles.includes(role)) {
        return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 }) };
    }

    return { authorized: true, user };
}

/**
 * GET /api/guidelines/:id
 * Get specific guideline (including PDF content for download)
 * Access: FLEET+
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await checkAuth();
    if (!auth.authorized) return auth.error;

    const { id } = await params;

    try {
        const guideline = await prisma.guideline.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        email: true
                    }
                }
            }
        });

        if (!guideline) {
            return NextResponse.json(
                { error: 'Guideline not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ guideline });
    } catch (error) {
        console.error('Error fetching guideline:', error);
        return NextResponse.json(
            { error: 'Failed to fetch guideline' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/guidelines/:id
 * Update guideline name and/or environment association
 * Access: FLEET+
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await checkAuth();
    if (!auth.authorized) return auth.error;

    const { id } = await params;

    try {
        const body = await request.json();
        const { name, environments } = body;

        // Check if guideline exists
        const existing = await prisma.guideline.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Guideline not found' },
                { status: 404 }
            );
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (environments !== undefined) {
            updateData.environments = environments || [];
        }

        const guideline = await prisma.guideline.update({
            where: { id },
            data: updateData,
            include: {
                users: {
                    select: {
                        email: true
                    }
                }
            }
        });

        logAudit({
            action: 'GUIDELINE_UPDATED',
            entityType: 'GUIDELINE',
            entityId: id,
            userId: auth.user!.id,
            userEmail: auth.user!.email ?? 'unknown',
            metadata: { ...(name !== undefined ? { name } : {}), ...(environments !== undefined ? { environments } : {}) },
        }).catch(err => console.error('[Guidelines API] Audit log failed:', err));

        return NextResponse.json({ guideline });
    } catch (error) {
        console.error('Error updating guideline:', error);
        return NextResponse.json(
            { error: 'Failed to update guideline' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/guidelines/:id
 * Delete guideline
 * Access: FLEET+
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await checkAuth();
    if (!auth.authorized) return auth.error;

    const { id } = await params;

    try {
        // Check if guideline exists
        const existing = await prisma.guideline.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Guideline not found' },
                { status: 404 }
            );
        }

        await prisma.guideline.delete({
            where: { id }
        });

        logAudit({
            action: 'GUIDELINE_DELETED',
            entityType: 'GUIDELINE',
            entityId: id,
            userId: auth.user!.id,
            userEmail: auth.user!.email ?? 'unknown',
            metadata: { name: existing.name, environments: existing.environments },
        }).catch(err => console.error('[Guidelines API] Audit log failed:', err));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting guideline:', error);
        return NextResponse.json(
            { error: 'Failed to delete guideline' },
            { status: 500 }
        );
    }
}
