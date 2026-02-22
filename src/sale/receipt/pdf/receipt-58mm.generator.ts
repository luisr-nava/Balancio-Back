import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';
// const width = 58 * 2.834;

export class Receipt58mmGenerator implements ReceiptGenerator {
  private mmToPt(mm: number): number {
    return mm * 2.834;
  }

  private buildBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.end();
    });
  }

  async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
    const width = this.mmToPt(58);

    const doc = new PDFDocument({
      size: [width, 1000],
      margins: { top: 10, left: 10, right: 10, bottom: 10 },
    });

    const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

    const formatMoney = (value: number): string =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: snapshot.shop.currency,
      }).format(value);

    doc.font('Courier').fontSize(9);

    doc.text(snapshot.shop.name, { align: 'center' });
    if (snapshot.shop.address)
      doc.text(snapshot.shop.address, { align: 'center' });
    if (snapshot.shop.phone)
      doc.text(`Tel: ${snapshot.shop.phone}`, { align: 'center' });

    doc.moveDown();
    doc.text(`Date: ${snapshot.saleDate.toLocaleString(locale)}`);
    doc.moveDown();

    snapshot.items.forEach((item) => {
      doc.text(`${item.quantity} x ${formatMoney(item.unitPrice)}`);
      doc.text(item.name);
      doc.text(formatMoney(item.total), { align: 'right' });
      doc.moveDown(0.5);
    });

    doc.text('------------------------------');
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