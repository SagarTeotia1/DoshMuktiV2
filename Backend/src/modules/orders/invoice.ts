import PDFDocument from 'pdfkit';
import type { Order, OrderItem, Payment } from '@prisma/client';

type InvoiceOrder = Order & {
  items: OrderItem[];
  payment: Payment | null;
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

      // Header
      doc.fontSize(20).text('Doshhmukti', { align: 'left' });
      doc.fontSize(14).fillColor('#555555').text('Invoice', { align: 'left' });
      doc.moveDown(1);
      doc.fillColor('#000000');

      // Order meta
      doc.fontSize(10);
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.text(`Order Date: ${formatDate(order.createdAt)}`);
      doc.moveDown(1);

      // Customer details
      doc.fontSize(12).text('Bill To', { underline: true });
      doc.fontSize(10);
      doc.text(order.customerName);
      doc.text(order.customerPhone);
      if (order.customerEmail) doc.text(order.customerEmail);
      doc.moveDown(1);

      // Shipping address
      const addr = order.shippingAddress as unknown as ShippingAddress;
      doc.fontSize(12).text('Shipping Address', { underline: true });
      doc.fontSize(10);
      doc.text(addr.line1);
      if (addr.line2) doc.text(addr.line2);
      doc.text(`${addr.city}, ${addr.state} ${addr.pincode}`);
      doc.text(addr.country);
      doc.moveDown(1.5);

      // Itemized table
      doc.fontSize(12).text('Items', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colProduct = 50;
      const colSku = 230;
      const colQty = 340;
      const colPrice = 390;
      const colTotal = 470;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Product', colProduct, tableTop);
      doc.text('SKU', colSku, tableTop);
      doc.text('Qty', colQty, tableTop);
      doc.text('Price', colPrice, tableTop);
      doc.text('Total', colTotal, tableTop);
      doc.moveDown(0.5);
      doc.font('Helvetica');

      const lineY = doc.y;
      doc.moveTo(colProduct, lineY).lineTo(545, lineY).strokeColor('#cccccc').stroke();
      doc.moveDown(0.3);

      let totalTaxableValue = 0;
      let totalGstAmount = 0;

      for (const item of order.items) {
        const snapshot = item.variantSnapshot as unknown as VariantSnapshot;
        const price = Number(item.priceAtPurchase);
        const lineTotal = price * item.quantity;
        const rowY = doc.y;
        const gstRate = typeof snapshot.gstRate === 'number' ? snapshot.gstRate : null;

        if (gstRate !== null) {
          const { taxableValue, gstAmount } = computeItemGst(lineTotal, gstRate);
          totalTaxableValue += taxableValue;
          totalGstAmount += gstAmount;
        }

        const skuLabel = gstRate !== null ? `${snapshot.sku ?? '-'} (GST ${gstRate}%)` : (snapshot.sku ?? '-');

        doc.fontSize(9);
        doc.text(snapshot.productName ?? '-', colProduct, rowY, { width: colSku - colProduct - 10 });
        doc.text(skuLabel, colSku, rowY, { width: colQty - colSku - 10 });
        doc.text(String(item.quantity), colQty, rowY, { width: colPrice - colQty - 10 });
        doc.text(formatCurrency(item.priceAtPurchase), colPrice, rowY, { width: colTotal - colPrice - 10 });
        doc.text(formatCurrency(lineTotal), colTotal, rowY);
        doc.moveDown(0.7);
      }

      doc.moveDown(0.5);
      const dividerY = doc.y;
      doc.moveTo(colProduct, dividerY).lineTo(545, dividerY).strokeColor('#cccccc').stroke();
      doc.moveDown(0.7);

      // Totals block
      const totalsLabelX = 380;
      const totalsValueX = 470;

      const writeTotalRow = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10);
        doc.text(label, totalsLabelX, y);
        doc.text(value, totalsValueX, y);
        doc.moveDown(0.5);
      };

      writeTotalRow('Subtotal', formatCurrency(order.subtotal));
      writeTotalRow('Shipping Fee', formatCurrency(order.shippingFee));

      const discount = Number(order.discountAmount);
      if (discount > 0) writeTotalRow('Discount', `- ${formatCurrency(order.discountAmount)}`);

      const walletRedeemed = Number(order.walletRedeemed);
      if (walletRedeemed > 0) writeTotalRow('Wallet Redeemed', `- ${formatCurrency(order.walletRedeemed)}`);

      // GST is an inclusive breakup of amounts already counted in Subtotal above — these
      // two rows are informational only and never change the Total. Omitted entirely when
      // no item on the order has a gstRate set (showing "GST: Rs. 0.00" would be misleading).
      if (totalGstAmount > 0) {
        writeTotalRow('Taxable Value', formatCurrency(totalTaxableValue));
        writeTotalRow('GST', formatCurrency(totalGstAmount));
      }

      doc.moveDown(0.3);
      writeTotalRow('Total', formatCurrency(order.total), true);
      doc.font('Helvetica');
      doc.moveDown(1);

      // Payment details
      if (order.payment) {
        doc.fontSize(12).text('Payment Details', { underline: true });
        doc.fontSize(10);
        doc.text(`Payment ID: ${order.payment.razorpayPaymentId ?? '-'}`);
        doc.text(`Payment Confirmed: ${formatDate(order.payment.verifiedAt)}`);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
