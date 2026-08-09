import { env } from '../../../config/env';

// Groq's chat completions API is OpenAI-compatible — swapping to OpenRouter later
// is a base-URL + model-name change here, nothing downstream needs to know.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('Groq API key not configured');
    this.name = 'GroqNotConfiguredError';
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { jsonMode?: boolean },
): Promise<string> {
  if (!env.GROQ_API_KEY) throw new GroqNotConfiguredError();

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 500,
      ...(opts?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "I'm not able to answer that right now — try again in a moment.";
}
