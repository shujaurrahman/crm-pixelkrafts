import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = 'gemini-1.5-flash';
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

function isQuotaLikeError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('daily limit')
  );
}

async function generateWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateWithHuggingFace(prompt: string) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.2,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HuggingFace request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as
    | Array<{ generated_text?: string }>
    | { generated_text?: string }
    | { error?: string };

  if (Array.isArray(payload)) {
    return payload[0]?.generated_text?.trim() || '';
  }

  if ('generated_text' in payload && payload.generated_text) {
    return payload.generated_text.trim();
  }

  if ('error' in payload && payload.error) {
    throw new Error(`HuggingFace error: ${payload.error}`);
  }

  return '';
}

export async function generateTextWithFallback(prompt: string): Promise<{ text: string; provider: 'gemini' | 'huggingface' }> {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasHf = Boolean(process.env.HUGGINGFACE_API_KEY?.trim());

  if (!hasGemini && !hasHf) {
    throw new Error('No AI provider configured. Set GEMINI_API_KEY or HUGGINGFACE_API_KEY.');
  }

  if (hasGemini) {
    try {
      const text = await generateWithGemini(prompt);
      return { text, provider: 'gemini' };
    } catch (error) {
      if (!hasHf || !isQuotaLikeError(error)) {
        throw error;
      }
    }
  }

  const hfText = await generateWithHuggingFace(prompt);
  return { text: hfText, provider: 'huggingface' };
}
