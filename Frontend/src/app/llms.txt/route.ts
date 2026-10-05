import { buildLlmsTxt, LLMS_FALLBACK, LLMS_HEADERS } from '@/lib/llms';

export const revalidate = 3600;

export async function GET() {
  let body: string;
  try {
    body = await buildLlmsTxt();
  } catch (err) {
    console.error('llms.txt: build failed', err);
    body = LLMS_FALLBACK;
  }
  return new Response(body, { headers: LLMS_HEADERS });
}
