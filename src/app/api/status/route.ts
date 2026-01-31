import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    let databaseConnected = false;

    try {
        // Simple database connectivity check
        // Just tries to execute a basic query
        await prisma.$queryRaw`SELECT 1`;
        databaseConnected = true;
    } catch (error) {
        console.error('[Status API] Database check failed:', error);
        databaseConnected = false;
    }

    return NextResponse.json({
        server: true, // If we're responding, server is up
        database: databaseConnected,
        timestamp: new Date().toISOString()
    });
}
