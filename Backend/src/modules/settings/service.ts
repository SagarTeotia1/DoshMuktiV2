import { db } from '../../shared/db/client';
import { DEFAULT_COD_FEE_CONFIG, type CodFeeConfig } from '../../shared/shipping/carrier';
import { codFeeConfigSchema } from './schema';

const COD_FEE_KEY = 'cod_fee';
const CACHE_MS = 30_000;
let cache: { value: CodFeeConfig; at: number } | null = null;

// Falls back to the built-in default when unset or corrupt — a bad row must never block checkout.
export async function getCodFeeConfig(): Promise<CodFeeConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const row = await db.storeSetting.findUnique({ where: { key: COD_FEE_KEY } });
  const parsed = codFeeConfigSchema.safeParse(row?.value);
  const value = parsed.success ? parsed.data : DEFAULT_COD_FEE_CONFIG;
  cache = { value, at: Date.now() };
  return value;
}

export async function setCodFeeConfig(config: CodFeeConfig): Promise<CodFeeConfig> {
  await db.storeSetting.upsert({
    where: { key: COD_FEE_KEY },
    create: { key: COD_FEE_KEY, value: { ...config } },
    update: { value: { ...config } },
  });
  cache = { value: config, at: Date.now() };
  return config;
}
