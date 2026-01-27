import { NextResponse } from 'next/server';
import { getOpenRouterBalance, getActiveProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const provider = getActiveProvider();

    if (provider !== 'openrouter') {
      return NextResponse.json({
        provider,
        balance: null,
        message: 'Balance tracking only available for OpenRouter',
      });
    }

    const balance = await getOpenRouterBalance();

    return NextResponse.json({
      provider,
      balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Balance API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
