
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import { logAudit } from '@repo/core/audit';
import { requireAdminRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;

    try {
        const settings = await prisma.systemSetting.findMany();
        const map = settings.reduce((acc: Record<string, string>, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);

        return NextResponse.json({
            ai_provider: map['ai_provider'] || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'lmstudio'),
            // Fallback logic mirrors src/lib/ai.ts
            ai_host: map['ai_host'] || process.env.AI_HOST || 'http://localhost:1234/v1',
            llm_model: map['llm_model'] || (map['ai_provider'] === 'openrouter' ? process.env.OPENROUTER_LLM_MODEL : process.env.LLM_MODEL) || 'meta-llama-3-8b-instruct',
            embedding_model: map['embedding_model'] || (map['ai_provider'] === 'openrouter' ? process.env.OPENROUTER_EMBEDDING_MODEL : process.env.EMBEDDING_MODEL) || 'text-embedding-nomic-embed-text-v1.5',
            openrouter_key: map['openrouter_key'] ? '__masked__' : '',
            linear_api_key: map['linear_api_key'] ? '__masked__' : '',
            linear_team_id: map['linear_team_id'] || '',
            linear_webhook_secret: map['linear_webhook_secret'] ? '__masked__' : '',
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const authResult = await requireAdminRole();
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    try {
        const body = await request.json();
        const allowedKeys = ['ai_provider', 'ai_host', 'llm_model', 'embedding_model', 'openrouter_key', 'linear_api_key', 'linear_team_id', 'linear_webhook_secret'];
        const maskedKeys = new Set(['openrouter_key', 'linear_api_key', 'linear_webhook_secret']);

        const operations = Object.entries(body)
            .filter(([key]) => allowedKeys.includes(key))
            .filter(([key, value]) => !(maskedKeys.has(key) && value === '__masked__'))
            .map(([key, value]) => {
                return prisma.systemSetting.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) }
                });
            });

        await prisma.$transaction(operations);

        // Log audit event
        // Log audit event (non-critical)
        await logAudit({
            action: 'SYSTEM_SETTINGS_UPDATED',
            entityType: 'SYSTEM_SETTING',
            userId: user.id,
            userEmail: user.email!,
            metadata: { updatedSettings: Object.keys(body).filter(key => allowedKeys.includes(key)) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
