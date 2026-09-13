// Manual/local dump of the same feed served live at GET /api/catalog.csv (see
// src/modules/catalog/service.ts, the single source of truth for the mapping). Point Meta
// Commerce Manager's scheduled data feed at that URL instead of running this repeatedly —
// it re-fetches on its own and always reflects current stock/price. This script is only
// for a one-off local copy.
import { db } from '../src/shared/db/client';
import { buildCatalogCsv } from '../src/modules/catalog/service';

const DEFAULT_OUTPUT = 'C:\\Users\\Lenovo\\Downloads\\catalog_products.csv';

async function main() {
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT;
  const csv = await buildCatalogCsv();

  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, csv, 'utf8');

  const rows = csv.split('\r\n').length - 1;
  console.log(`Exported ${rows} row(s) to ${outputPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
