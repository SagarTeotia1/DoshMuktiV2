import { PDFDocument } from 'pdf-lib';

export type LabelSize = '4x6' | 'A4';

/**
 * Delhivery packing slips are returned as A4 pages (595 x 842 pt) by default,
 * with the actual shipping label located in a sub-rectangle on the sheet.
 *
 * For A4 format:
 * - Returns Delhivery's original unmodified A4 PDF so it prints cleanly on standard paper.
 *
 * For 4x6 (Thermal printer) format:
 * - If the PDF is already thermal-sized (width < 400pt), returns it as-is.
 * - If the PDF is Delhivery's standard A4 slip, sets MediaBox and CropBox to the exact
 *   bounding box of the shipping label (x: 210, y: 370, w: 260, h: 454 in bottom-up pt)
 *   with clean margins, preserving 100% vector clarity and full-size thermal printer fit.
 */
export async function fixLabelPdf(sourceBytes: Buffer, size: LabelSize): Promise<Buffer> {
  if (size === 'A4') {
    return sourceBytes;
  }

  const doc = await PDFDocument.load(sourceBytes);
  const page = doc.getPage(0);
  const { width, height } = page.getSize();

  // If already thermal / 4x6 sized, return unmodified
  if (width < 400 && height < 650) {
    return sourceBytes;
  }

  // Delhivery A4 slip: label bounding box in bottom-up PDF coordinates
  // Visual top-down coordinates: x ≈ 212..469, y ≈ 20..470 on 595x842 page
  // PDF bottom-up coordinates: x = 210, y = height - 472 (370 for A4), width = 260, height = 454
  const LABEL_X = 210;
  const LABEL_Y = Math.max(0, Math.round(height - 472));
  const LABEL_W = 260;
  const LABEL_H = 454;

  page.setMediaBox(LABEL_X, LABEL_Y, LABEL_W, LABEL_H);
  page.setCropBox(LABEL_X, LABEL_Y, LABEL_W, LABEL_H);

  return Buffer.from(await doc.save());
}
