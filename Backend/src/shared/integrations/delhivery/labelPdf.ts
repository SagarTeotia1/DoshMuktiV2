import { PDFDocument } from 'pdf-lib';

export type LabelSize = '4x6' | 'A4';

// Delhivery's packing_slip PDF draws its content in a 792x612pt (11x8.5in,
// Letter-landscape) coordinate space but declares the page's own MediaBox as
// A4 (595x842pt) — the mismatch shoves the label into the bottom-left corner
// with the right edge clipped and the top left blank. Overriding the page's
// box to the space the content was actually drawn in recovers the full label,
// which is then scaled to fit (and centered) on the requested output size.
const DELHIVERY_DESIGN_WIDTH = 792;
const DELHIVERY_DESIGN_HEIGHT = 612;

const OUTPUT_SIZES: Record<LabelSize, { width: number; height: number }> = {
  '4x6': { width: 4 * 72, height: 6 * 72 },
  A4: { width: 595.28, height: 841.89 },
};

export async function fixLabelPdf(sourceBytes: Buffer, size: LabelSize): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(sourceBytes);
  const page = srcDoc.getPage(0);
  page.setMediaBox(0, 0, DELHIVERY_DESIGN_WIDTH, DELHIVERY_DESIGN_HEIGHT);
  page.setCropBox(0, 0, DELHIVERY_DESIGN_WIDTH, DELHIVERY_DESIGN_HEIGHT);

  const outDoc = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPdf(srcDoc, [0]);
  const embedded = embeddedPages[0]!;

  const { width: outW, height: outH } = OUTPUT_SIZES[size];
  const outPage = outDoc.addPage([outW, outH]);
  const scale = Math.min(outW / DELHIVERY_DESIGN_WIDTH, outH / DELHIVERY_DESIGN_HEIGHT);
  const w = DELHIVERY_DESIGN_WIDTH * scale;
  const h = DELHIVERY_DESIGN_HEIGHT * scale;
  outPage.drawPage(embedded, { x: (outW - w) / 2, y: (outH - h) / 2, width: w, height: h });

  return Buffer.from(await outDoc.save());
}
