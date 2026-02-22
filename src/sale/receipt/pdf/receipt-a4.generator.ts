import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';
// const width = 210 * 2.834; // A4 width in mm converted to points

export class ReceiptA4Generator implements ReceiptGenerator {
  private buildBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.end();
    });
  }

  async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, left: 40, right: 40, bottom: 40 },
    });

    const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

    const formatMoney = (value: number): string =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: snapshot.shop.currency,
      }).format(value);

    doc.fontSize(16).text(snapshot.shop.name, { align: 'center' });
    doc.moveDown(2);

    snapshot.items.forEach((item) => {
      doc
        .fontSize(12)
        .text(
          `${item.name} - ${item.quantity} x ${formatMoney(item.unitPrice)}`,
        );
      doc.text(formatMoney(item.total), { align: 'right' });
      doc.moveDown();
    });

    doc.moveDown();
    doc.text(`Subtotal: ${formatMoney(snapshot.totals.subtotal)}`, {
      align: 'right',
    });
    doc.text(`Tax: ${formatMoney(snapshot.totals.tax)}`, { align: 'right' });
    doc.text(`TOTAL: ${formatMoney(snapshot.totals.total)}`, {
      align: 'right',
    });

    return this.buildBuffer(doc);
  }
}
