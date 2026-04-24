import { NextResponse } from 'next/server';
import { generateTextWithFallback } from '../../../lib/ai-fallback';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string; leads?: unknown[] };
    if (!body.question || !Array.isArray(body.leads)) {
      return NextResponse.json({ error: 'Missing question or leads' }, { status: 400 });
    }

    const prompt = `You are a lead CRM analyst.
Answer with concise insights and numbers. Use INR currency and bullet points where useful.

Question: ${body.question}

Leads data JSON:
${JSON.stringify(body.leads)}`;

  const { text, provider } = await generateTextWithFallback(prompt);
  const answer = text.trim();

  return NextResponse.json({ answer, provider });
  } catch (error) {
    console.error('Chat API error', error);
    const message = error instanceof Error ? error.message : 'Chat request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
