const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

// Meta's catalog feed is configured to fetch https://doshmukti.com/datafeed.csv — this just
// proxies that fixed public URL to the Backend's live feed at /api/catalog.csv so the URL
// submitted to Meta Commerce Manager never has to change even if the Backend host does.
export async function GET() {
  const res = await fetch(`${BASE_URL}/api/catalog.csv`, { cache: 'no-store' });

  if (!res.ok) {
    return new Response('Catalog feed unavailable', { status: 502 });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
      'Cache-Control': res.headers.get('Cache-Control') ?? 'public, max-age=1800',
      'Content-Disposition': 'inline; filename="catalog_products.csv"',
    },
  });
}
