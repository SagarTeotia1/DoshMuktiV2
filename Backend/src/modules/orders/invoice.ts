import PDFDocument from 'pdfkit';
import type { Order, OrderItem, Payment, Shipment } from '@prisma/client';

type InvoiceOrder = Order & {
  items: OrderItem[];
  payment: Payment | null;
  shipment: Shipment | null;
};

type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type VariantSnapshot = {
  productName: string;
  sku: string;
  attributes?: Record<string, unknown>;
  gstRate?: number | null;
};

const BRAND = '#9C5A26';
const INK = '#2B1B0C';
const MUTED = '#8A7A63';
const RULE = '#E4D8C4';
const PANEL = '#F6EFE1';

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;

// GST is an inclusive breakup of the existing line total, never an added charge —
// taxableValue + gstAmount always sum back to lineTotal. Purely a display/reporting
// computation; does not touch checkout's actual pricing/stock/total logic.
function computeItemGst(lineTotal: number, gstRate: number): { taxableValue: number; gstAmount: number } {
  const taxableValue = lineTotal / (1 + gstRate / 100);
  return { taxableValue, gstAmount: lineTotal - taxableValue };
}

const formatCurrency = (value: unknown): string => {
  const num = typeof value === 'object' && value !== null && 'toNumber' in value
    ? (value as { toNumber: () => number }).toNumber()
    : Number(value);
  return `Rs. ${num.toFixed(2)}`;
};

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
};

export async function generateInvoicePdf(order: InvoiceOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // ── Header band ──────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill(INK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('Doshhmukti', PAGE_LEFT, 30);
      doc.font('Helvetica').fontSize(9).fillColor('#E6D3AE').text('Vedic gemstones, rudraksha & remedies', PAGE_LEFT, 56);

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#FFFFFF').text('TAX INVOICE', PAGE_LEFT, 30, { width: PAGE_RIGHT - PAGE_LEFT, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#E6D3AE').text(order.orderNumber, PAGE_LEFT, 56, { width: PAGE_RIGHT - PAGE_LEFT, align: 'right' });

      doc.fillColor(INK);
      let y = 112;

      // ── Order meta strip (order date / payment / AWB) ───────────────────
      const metaBoxHeight = 46;
      doc.roundedRect(PAGE_LEFT, y, PAGE_RIGHT - PAGE_LEFT, metaBoxHeight, 4).fill(PANEL);
      const metaColWidth = (PAGE_RIGHT - PAGE_LEFT) / 3;
      const metaY = y + 10;

      function metaCell(x: number, label: string, value: string) {
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, metaY, { characterSpacing: 0.5 });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(value, x, metaY + 12);
      }

      metaCell(PAGE_LEFT + 14, 'Order Date', formatDate(order.createdAt));
      metaCell(PAGE_LEFT + 14 + metaColWidth, 'Payment ID', order.payment?.razorpayPaymentId ?? '—');
      metaCell(
        PAGE_LEFT + 14 + metaColWidth * 2,
        'AWB / Tracking No.',
        order.shipment?.delhiveryWaybill ?? 'Not yet booked'
      );

      y += metaBoxHeight + 20;

      // ── Bill To / Ship To (two columns) ──────────────────────────────────
      const addr = order.shippingAddress as unknown as ShippingAddress;
      const colWidth = (PAGE_RIGHT - PAGE_LEFT - 20) / 2;

      function sectionLabel(x: number, yPos: number, text: string) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(text.toUpperCase(), x, yPos, { characterSpacing: 0.5 });
      }

      sectionLabel(PAGE_LEFT, y, 'Bill To');
      sectionLabel(PAGE_LEFT + colWidth + 20, y, 'Ship To');
      let leftY = y + 16;
      let rightY = y + 16;

      doc.font('Helvetica').fontSize(10).fillColor(INK);
      doc.text(order.customerName, PAGE_LEFT, leftY, { width: colWidth });
      leftY = doc.y;
      doc.fillColor(MUTED).text(order.customerPhone, PAGE_LEFT, leftY, { width: colWidth });
      leftY = doc.y;
      if (order.customerEmail) {
        doc.text(order.customerEmail, PAGE_LEFT, leftY, { width: colWidth });
        leftY = doc.y;
      }

      doc.fillColor(INK);
      const shipX = PAGE_LEFT + colWidth + 20;
      doc.text(addr.line1, shipX, rightY, { width: colWidth });
      rightY = doc.y;
      if (addr.line2) {
        doc.text(addr.line2, shipX, rightY, { width: colWidth });
        rightY = doc.y;
      }
      doc.fillColor(MUTED).text(`${addr.city}, ${addr.state} — ${addr.pincode}`, shipX, rightY, { width: colWidth });
      rightY = doc.y;
      doc.text(addr.country, shipX, rightY, { width: colWidth });
      rightY = doc.y;

      y = Math.max(leftY, rightY) + 18;
      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(RULE).lineWidth(1).stroke();
      y += 20;

      // ── Itemized table ───────────────────────────────────────────────────
      const colProduct = PAGE_LEFT;
      const colSku = PAGE_LEFT + 190;
      const colQty = PAGE_LEFT + 310;
      const colPrice = PAGE_LEFT + 355;
      const colTotal = PAGE_LEFT + 435;
      const rowPad = 8;

      function tableHeader(headerY: number): number {
        doc.rect(PAGE_LEFT, headerY, PAGE_RIGHT - PAGE_LEFT, 22).fill(INK);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
        doc.text('PRODUCT', colProduct + 10, headerY + 7);
        doc.text('SKU', colSku, headerY + 7);
        doc.text('QTY', colQty, headerY + 7);
        doc.text('PRICE', colPrice, headerY + 7);
        doc.text('AMOUNT', colTotal, headerY + 7, { width: PAGE_RIGHT - colTotal - 10, align: 'right' });
        doc.fillColor(INK);
        return headerY + 22;
      }

      y = tableHeader(y);

      let totalTaxableValue = 0;
      let totalGstAmount = 0;

      order.items.forEach((item, idx) => {
        const snapshot = item.variantSnapshot as unknown as VariantSnapshot;
        const price = Number(item.priceAtPurchase);
        const lineTotal = price * item.quantity;
        const gstRate = typeof snapshot.gstRate === 'number' ? snapshot.gstRate : null;

        if (gstRate !== null) {
          const { taxableValue, gstAmount } = computeItemGst(lineTotal, gstRate);
          totalTaxableValue += taxableValue;
          totalGstAmount += gstAmount;
        }

        const nameHeight = doc.font('Helvetica').fontSize(9.5).heightOfString(snapshot.productName ?? '-', { width: colSku - colProduct - 20 });
        const rowHeight = Math.max(nameHeight, 14) + rowPad * 2;

        // New page if this row would overflow
        if (y + rowHeight > doc.page.height - 220) {
          doc.addPage();
          y = 50;
          y = tableHeader(y);
        }

        if (idx % 2 === 1) doc.rect(PAGE_LEFT, y, PAGE_RIGHT - PAGE_LEFT, rowHeight).fill(PANEL).fillColor(INK);

        const textY = y + rowPad;
        const skuLabel = gstRate !== null ? `${snapshot.sku ?? '-'} (GST ${gstRate}%)` : (snapshot.sku ?? '-');

        doc.font('Helvetica').fontSize(9.5).fillColor(INK);
        doc.text(snapshot.productName ?? '-', colProduct + 10, textY, { width: colSku - colProduct - 20 });
        doc.fillColor(MUTED).fontSize(8.5).text(skuLabel, colSku, textY, { width: colQty - colSku - 10 });
        doc.fillColor(INK).fontSize(9.5);
        doc.text(String(item.quantity), colQty, textY, { width: colPrice - colQty - 10 });
        doc.text(formatCurrency(item.priceAtPurchase), colPrice, textY, { width: colTotal - colPrice - 10 });
        doc.font('Helvetica-Bold').text(formatCurrency(lineTotal), colTotal, textY, { width: PAGE_RIGHT - colTotal - 10, align: 'right' });
        doc.font('Helvetica');

        y += rowHeight;
      });

      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(RULE).lineWidth(1).stroke();
      y += 16;

      // ── Totals panel (right-aligned box) ─────────────────────────────────
      const totalsWidth = 230;
      const totalsX = PAGE_RIGHT - totalsWidth;
      const discount = Number(order.discountAmount);
      const showGst = totalGstAmount > 0;

      const totalsRows: Array<{ label: string; value: string; bold?: boolean; accent?: boolean }> = [
        { label: 'Subtotal', value: formatCurrency(order.subtotal) },
        { label: 'Shipping Fee', value: formatCurrency(order.shippingFee) },
      ];
      if (discount > 0) totalsRows.push({ label: 'Discount', value: `- ${formatCurrency(order.discountAmount)}`, accent: true });
      if (showGst) {
        totalsRows.push({ label: 'Taxable Value', value: formatCurrency(totalTaxableValue) });
        totalsRows.push({ label: 'GST', value: formatCurrency(totalGstAmount) });
      }

      const rowH = 20;
      const panelHeight = totalsRows.length * rowH + 44;
      doc.roundedRect(totalsX, y, totalsWidth, panelHeight, 4).fill(PANEL).fillColor(INK);

      let rowY = y + 12;
      for (const row of totalsRows) {
        doc.font('Helvetica').fontSize(9.5).fillColor(row.accent ? BRAND : MUTED);
        doc.text(row.label, totalsX + 14, rowY);
        doc.fillColor(row.accent ? BRAND : INK).text(row.value, totalsX + 14, rowY, { width: totalsWidth - 28, align: 'right' });
        rowY += rowH;
      }

      doc.moveTo(totalsX + 14, rowY).lineTo(totalsX + totalsWidth - 14, rowY).strokeColor(RULE).stroke();
      rowY += 10;

      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK);
      doc.text('Total', totalsX + 14, rowY);
      doc.fillColor(BRAND).text(formatCurrency(order.total), totalsX + 14, rowY, { width: totalsWidth - 28, align: 'right' });

      y += panelHeight + 30;

      // ── Shipment / tracking details ──────────────────────────────────────
      if (order.shipment?.delhiveryWaybill) {
        if (y > doc.page.height - 140) {
          doc.addPage();
          y = 50;
        }
        sectionLabel(PAGE_LEFT, y, 'Shipment Details');
        y += 16;
        doc.roundedRect(PAGE_LEFT, y, PAGE_RIGHT - PAGE_LEFT, 44, 4).strokeColor(RULE).lineWidth(1).stroke();
        const shipMetaY = y + 10;
        const shipColWidth = (PAGE_RIGHT - PAGE_LEFT) / 3;
        metaCell2(PAGE_LEFT + 14, shipMetaY, 'Courier Partner', 'Delhivery');
        metaCell2(PAGE_LEFT + 14 + shipColWidth, shipMetaY, 'AWB Number', order.shipment.delhiveryWaybill);
        metaCell2(PAGE_LEFT + 14 + shipColWidth * 2, shipMetaY, 'Status', order.shipment.status);
        y += 44 + 24;

        function metaCell2(x: number, yy: number, label: string, value: string) {
          doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, yy, { characterSpacing: 0.5 });
          doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(value, x, yy + 12, { width: shipColWidth - 20 });
        }
      }

      // ── Footer ────────────────────────────────────────────────────────────
      // Kept well clear of the page's bottom margin (792 - 50 default) — pdfkit silently
      // pushes a text call to a new page if its computed box would cross the margin, even
      // with an explicit y, which previously stranded just the last footer line alone on
      // a blank page 2.
      const footerY = doc.page.height - 90;
      doc.moveTo(PAGE_LEFT, footerY).lineTo(PAGE_RIGHT, footerY).strokeColor(RULE).stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text('This is a system-generated invoice and does not require a signature.', PAGE_LEFT, footerY + 10);
      doc.text('doshhmukti@gmail.com  ·  doshmukti.com', PAGE_LEFT, footerY + 24, { width: PAGE_RIGHT - PAGE_LEFT, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
