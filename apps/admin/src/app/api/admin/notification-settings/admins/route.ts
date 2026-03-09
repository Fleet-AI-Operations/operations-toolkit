import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { requireAdminRole } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminRole();
  if ('error' in authResult) return authResult.error;

  try {
    // Fetch all admin users
    const admins = await prisma.profile.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { email: 'asc' }
      ]
    });

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Failed to fetch admins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    );
  }
}
