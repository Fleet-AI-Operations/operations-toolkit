import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Parse DB Host/Port from connection string (sanitized)
        // Check multiple possible database URL environment variables
        const dbUrl = process.env.DATABASE_URL ||
                      process.env.POSTGRES_PRISMA_URL ||
                      process.env.POSTGRES_URL ||
                      process.env.POSTGRES_URL_NON_POOLING ||
                      '';
        let dbHost = 'Unknown';
        let dbPort = 'Unknown';

        // If we have a connection URL, parse it
        if (dbUrl) {
            try {
                // regex to capture host and port: postgres://user:pass@HOST:PORT/db
                const match = dbUrl.match(/@([^:]+):(\d+)\//);
                if (match) {
                    dbHost = match[1];
                    dbPort = match[2];
                } else if (dbUrl.includes('@')) {
                    // Fallback simpler parse
                    const parts = dbUrl.split('@')[1].split('/')[0].split(':');
                    dbHost = parts[0];
                    dbPort = parts[1] || '5432';
                }
            } catch (e) {
                console.error('Failed to parse DB URL', e);
            }
        } else {
            // If no URL available, check for individual components
            dbHost = process.env.POSTGRES_HOST || 'Unknown';
            dbPort = '5432'; // Default PostgreSQL port
        }

        // Determine AI Provider info - check database first, then env vars
        let aiProvider = 'LM Studio (Local)';
        let aiHost = 'http://localhost:1234/v1';
        let llmModel = 'Unknown';
        let embeddingModel = 'Unknown';

        try {
            // Try to fetch settings from database (same as lib/ai.ts)
            const settings = await prisma.systemSetting.findMany({
                where: {
                    key: { in: ['ai_provider', 'ai_host', 'llm_model', 'embedding_model'] }
                }
            });

            const getSetting = (k: string) => settings.find(s => s.key === k)?.value;
            const dbProvider = getSetting('ai_provider');

            if (dbProvider === 'openrouter') {
                aiProvider = 'OpenRouter';
                aiHost = getSetting('ai_host') || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
                llmModel = getSetting('llm_model') || process.env.OPENROUTER_LLM_MODEL || 'Unknown';
                embeddingModel = getSetting('embedding_model') || process.env.OPENROUTER_EMBEDDING_MODEL || 'Unknown';
            } else if (dbProvider === 'lmstudio') {
                aiProvider = 'LM Studio (Local)';
                aiHost = (getSetting('ai_host') || process.env.AI_HOST || 'http://localhost:1234/v1').replace('host.docker.internal', 'localhost');
                llmModel = getSetting('llm_model') || process.env.LLM_MODEL || 'Unknown';
                embeddingModel = getSetting('embedding_model') || process.env.EMBEDDING_MODEL || 'Unknown';
            }
        } catch (dbError) {
            console.error('Failed to fetch AI settings from database, falling back to env vars:', dbError);
            // Fallback to environment variables only
            const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
            aiProvider = isOpenRouter ? 'OpenRouter' : 'LM Studio (Local)';
            aiHost = isOpenRouter
                ? (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1')
                : (process.env.AI_HOST || 'http://localhost:1234/v1').replace('host.docker.internal', 'localhost');
            llmModel = isOpenRouter
                ? (process.env.OPENROUTER_LLM_MODEL || 'Unknown')
                : (process.env.LLM_MODEL || 'Unknown');
            embeddingModel = isOpenRouter
                ? (process.env.OPENROUTER_EMBEDDING_MODEL || 'Unknown')
                : (process.env.EMBEDDING_MODEL || 'Unknown');
        }

        return NextResponse.json({
            database: {
                host: dbHost,
                port: dbPort
            },
            ai: {
                provider: aiProvider,
                host: aiHost,
                llmModel,
                embeddingModel
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
