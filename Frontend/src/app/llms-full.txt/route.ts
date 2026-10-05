import { buildLlmsFullTxt, LLMS_FALLBACK, LLMS_HEADERS } from '@/lib/llms';

export const revalidate = 3600;

export async function GET() {
  let body: string;
  try {
    body = await buildLlmsFullTxt();
  } catch (err) {
    console.error('llms-full.txt: build failed', err);
    body = LLMS_FALLBACK;
  }
  return new Response(body, { headers: LLMS_HEADERS });
}
