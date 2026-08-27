// In-process, free, local text embeddings via Transformers.js (@xenova/transformers) —
// no external API, no per-call billing. Used at BOTH ingestion time (once, by
// scripts/ingest-book.ts) and query time (every chat turn, by modules/chat/bookRetrieval.ts)
// so real vector search works end-to-end without an ongoing paid dependency.
//
// Model weights are downloaded once from the Hugging Face CDN on first use. Some networks
// (observed on the dev machine) have broken/reset IPv6 connectivity to huggingface.co while
// IPv4 works fine, which surfaces as an opaque "fetch failed" / ECONNRESET during download —
// prefer IPv4 resolution to avoid that. Harmless no-op on networks where IPv6 is fine.
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
//
// Model: Xenova/multilingual-e5-small — a 384-dim multilingual sentence embedding model
// (supports Hindi), quantized ONNX weights ship on the Xenova HF namespace specifically for
// Transformers.js. Weights download once on first use and are cached locally by the library
// (default cache dir under the OS user cache / node_modules/.cache), so subsequent process
// starts don't re-download.
//
// @xenova/transformers is an ESM-only package; this backend compiles to CommonJS
// (tsconfig "module": "commonjs"). A plain `import` or a naive `await import(...)` gets
// downleveled by tsc into a `require(...)` call for commonjs output, which fails on an
// ESM-only package. The Function-constructor indirection below hides the import specifier
// from TypeScript's downleveling so it stays a genuine dynamic `import()` at runtime, which
// Node's CJS loader supports natively.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<typeof import('@xenova/transformers')>;

export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIMENSIONS = 384;

// Cast pipeline output to this narrow shape rather than pulling in @xenova/transformers'
// full type surface here — we only ever call it as (text) => { data: Float32Array-like }.
type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: ArrayLike<number> }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

// Loads (or returns the already-loaded) embedding pipeline. Model weights are downloaded
// and initialized only once per process — cached as a module-level singleton — since doing
// this per-request would be far too slow for a live chat endpoint.
function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = dynamicImport('@xenova/transformers').then(({ pipeline }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pipeline('feature-extraction', EMBEDDING_MODEL) as unknown as Promise<FeatureExtractionPipeline>
    );
  }
  return pipelinePromise;
}

// Embeds a single piece of text into a normalized EMBEDDING_DIMENSIONS-length vector.
// e5 models expect a "query: " / "passage: " prefix convention to get best results —
// callers pass which side they're embedding via `kind`.
export async function embedText(text: string, kind: 'query' | 'passage'): Promise<number[]> {
  const extractor = await getPipeline();
  const prefixed = `${kind}: ${text}`;
  const output = await extractor(prefixed, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Formats an embedding vector as a pgvector literal, e.g. "[0.1,0.2,0.3]", for use inside a
// Prisma.sql tagged template (Prisma.sql\`... ${Prisma.raw(toVectorLiteral(v))}::vector ...\`).
// The values are numbers we computed ourselves (never user-controlled strings), so this is
// safe to interpolate directly — it is not string-concatenating untrusted content.
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
