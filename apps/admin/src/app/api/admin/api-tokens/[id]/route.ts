import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const { id } = await params;

    const token = await prisma.apiToken.findUnique({
        where: { id },
        select: { id: true, ownerId: true, name: true, revokedAt: true },
    });

    if (!token || token.ownerId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (token.revokedAt) {
        return NextResponse.json({ error: 'Token already revoked' }, { status: 409 });
    }

    await prisma.apiToken.update({
        where: { id },
        data: { revokedAt: new Date() },
    });

    await logAudit({
        action: 'API_TOKEN_REVOKED',
        entityType: 'API_TOKEN',
        entityId: id,
        userId: user.id,
        userEmail: user.email,
        metadata: { name: token.name },
    });

    return NextResponse.json({ success: true });
}
