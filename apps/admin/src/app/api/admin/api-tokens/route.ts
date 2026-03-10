import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const tokens = await prisma.apiToken.findMany({
        where: { ownerId: user.id },
        select: {
            id: true,
            name: true,
            tokenPrefix: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tokens);
}

export async function POST(request: Request) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const body = await request.json();
    const { name, expiresAt } = body as { name?: string; expiresAt?: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Generate token: otk_<64 random hex chars>
    const rawHex = randomBytes(32).toString('hex');
    const tokenValue = `otk_${rawHex}`;
    const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
    const tokenPrefix = rawHex.slice(0, 8);

    const token = await prisma.apiToken.create({
        data: {
            name: name.trim(),
            tokenHash,
            tokenPrefix,
            ownerId: user.id,
            createdById: user.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        select: {
            id: true,
            name: true,
            tokenPrefix: true,
            expiresAt: true,
            createdAt: true,
        },
    });

    await logAudit({
        action: 'API_TOKEN_CREATED',
        entityType: 'API_TOKEN',
        entityId: token.id,
        userId: user.id,
        userEmail: user.email,
        metadata: { name: token.name },
    });

    // Return the plaintext token only this once
    return NextResponse.json({ ...token, token: tokenValue }, { status: 201 });
}
