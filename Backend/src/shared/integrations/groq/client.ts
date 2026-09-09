import { env } from '../../../config/env';

// OpenRouter's chat completions API is OpenAI-compatible, same shape Groq used —
// this file (and its old "groq" folder name, kept to avoid a churny rename across every
// importer) only ever needed a base-URL + model-name + header change to move providers.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('OpenRouter API key not configured');
    this.name = 'GroqNotConfiguredError';
  }
}

async function requestCompletion(
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; maxTokens: number },
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // OpenRouter uses these purely for its own public leaderboard attribution — no
      // functional effect on the request, but the docs ask every caller to set them.
      'HTTP-Referer': env.FRONTEND_ORIGIN[0] ?? 'https://doshhmukti.com',
      'X-Title': 'Doshhmukti',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
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
  if (!env.OPENROUTER_API_KEY) throw new GroqNotConfiguredError();

  const first = await requestCompletion(messages, { jsonMode: opts?.jsonMode, maxTokens: 2048 });
  if (first.ok) return first.content || "I'm not able to answer that right now — try again in a moment.";

  // json_object mode can 400 with "json_validate_failed"/"invalid_json" when the model
  // runs out of budget mid-document, or a free/rate-limited model on OpenRouter returns
  // a transient 429/502 for an otherwise-fine request — retry once with a bigger token
  // cap before giving up, so a single verbose or momentarily-flaky turn doesn't fall all
  // the way back to the canned reply.
  const retryable =
    (first.status === 400 && /json_validate_failed|invalid_json/i.test(first.body)) ||
    first.status === 429 ||
    first.status >= 500;
  if (retryable) {
    const retry = await requestCompletion(messages, { jsonMode: opts?.jsonMode, maxTokens: 4096 });
    if (retry.ok) return retry.content || "I'm not able to answer that right now — try again in a moment.";
    throw new Error(`OpenRouter request failed: ${retry.status} ${retry.body}`);
  }

  throw new Error(`OpenRouter request failed: ${first.status} ${first.body}`);
}
