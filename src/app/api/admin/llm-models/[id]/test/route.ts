import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/llm-models/[id]/test
 * Test an LLM model connection via OpenRouter
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await requireRole(request, 'FLEET');
    if (authResult.error) return authResult.error;

    try {
        const model = await prisma.lLMModelConfig.findUnique({
            where: { id }
        });

        if (!model) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        // Get OpenRouter API key from settings or env
        const apiKeySetting = await prisma.systemSetting.findUnique({
            where: { key: 'openrouter_key' }
        });
        const apiKey = apiKeySetting?.value || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                error: 'OpenRouter API key not configured. Set it in Admin > AI Settings.'
            }, { status: 400 });
        }

        const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

        // Send a simple test request
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'Percentage Tool - Model Test'
            },
            body: JSON.stringify({
                model: model.modelId,
                messages: [
                    {
                        role: 'user',
                        content: 'Respond with exactly: "OK"'
                    }
                ],
                max_tokens: 10,
                temperature: 0
            })
        });

        const latency = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json({
                success: false,
                error: errorData.error?.message || `API returned ${response.status}`,
                statusCode: response.status,
                latency
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage = data.usage || {};

        return NextResponse.json({
            success: true,
            response: content.trim(),
            latency,
            usage: {
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0
            },
            modelInfo: {
                id: data.model,
                provider: model.modelId.split('/')[0]
            }
        });
    } catch (error: any) {
        console.error('Error testing LLM model:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to test model connection'
        }, { status: 500 });
    }
}
