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

async function requestCompletion(
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; maxTokens: number },
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: opts.maxTokens,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, body };
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return { ok: true, content: data.choices[0]?.message.content ?? '' };
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { jsonMode?: boolean },
): Promise<string> {
  if (!env.GROQ_API_KEY) throw new GroqNotConfiguredError();

  const first = await requestCompletion(messages, { jsonMode: opts?.jsonMode, maxTokens: 2048 });
  if (first.ok) return first.content || "I'm not able to answer that right now — try again in a moment.";

  // json_object mode can 400 with "json_validate_failed" when the model runs out of
  // budget mid-document — retry once with a bigger cap before giving up, so a single
  // verbose turn doesn't fall all the way back to the canned reply.
  if (first.status === 400 && first.body.includes('json_validate_failed')) {
    const retry = await requestCompletion(messages, { jsonMode: opts?.jsonMode, maxTokens: 4096 });
    if (retry.ok) return retry.content || "I'm not able to answer that right now — try again in a moment.";
    throw new Error(`Groq request failed: ${retry.status} ${retry.body}`);
  }

  throw new Error(`Groq request failed: ${first.status} ${first.body}`);
}
