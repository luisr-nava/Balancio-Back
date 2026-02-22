import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';

export class Receipt80mmGenerator implements ReceiptGenerator {
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

  // async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
  //   const width = this.mmToPt(80);

  //   // 🔥 Altura grande inicial (se recorta al final)
  //   const doc = new PDFDocument({
  //     size: [width, 5000],
  //     margins: { top: 10, left: 15, right: 15, bottom: 10 },
  //   });

  //   const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

  //   const formatMoney = (value: number): string =>
  //     new Intl.NumberFormat(locale, {
  //       style: 'currency',
  //       currency: snapshot.shop.currency,
  //     }).format(value);

  //   doc.font('Courier').fontSize(10);

  //   const margin = doc.page.margins.left;
  //   const pageWidth = doc.page.width;
  //   const usableWidth = pageWidth - margin * 2;

  //   // =============================
  //   // HEADER
  //   // =============================

  //   doc.text(snapshot.shop.name, { align: 'center' });

  //   if (snapshot.shop.address)
  //     doc.text(snapshot.shop.address, { align: 'center' });

  //   if (snapshot.shop.phone)
  //     doc.text(`Tel: ${snapshot.shop.phone}`, { align: 'center' });

  //   doc.moveDown();
  //   doc.text(`Date: ${snapshot.saleDate.toLocaleString(locale)}`);
  //   doc.moveDown();

  //   // =============================
  //   // ITEMS
  //   // =============================

  //   snapshot.items.forEach((item) => {
  //     const totalText = formatMoney(item.total);
  //     const totalWidth = doc.widthOfString(totalText);

  //     const nameWidth = usableWidth - totalWidth - 10;

  //     let y = doc.y;

  //     // Línea 1 → cantidad x precio
  //     doc.text(`${item.quantity} x ${formatMoney(item.unitPrice)}`, margin, y);

  //     y = doc.y + 2;

  //     // Altura real del nombre
  //     const nameHeight = doc.heightOfString(item.name, {
  //       width: nameWidth,
  //     });

  //     // Nombre (wrap automático)
  //     doc.text(item.name, margin, y, {
  //       width: nameWidth,
  //     });

  //     // Total fijo en primera línea del nombre
  //     doc.text(totalText, margin + usableWidth - totalWidth, y);

  //     // Avanzar cursor manualmente
  //     doc.y = y + nameHeight + 5;
  //   });

  //   doc.moveDown();

  //   // =============================
  //   // SEPARADOR DINÁMICO
  //   // =============================

  //   let line = '';
  //   while (doc.widthOfString(line + '-') < usableWidth) {
  //     line += '-';
  //   }

  //   doc.text(line, margin);
  //   doc.moveDown(0.5);

  //   // =============================
  //   // SUBTOTAL
  //   // =============================

  //   const subtotalText = formatMoney(snapshot.totals.subtotal);

  //   let y = doc.y;

  //   doc.text('Subtotal:', margin, y);

  //   doc.text(
  //     subtotalText,
  //     margin + usableWidth - doc.widthOfString(subtotalText),
  //     y,
  //   );

  //   doc.moveDown();

  //   // =============================
  //   // TOTAL (más destacado)
  //   // =============================

  //   const totalText = formatMoney(snapshot.totals.total);

  //   y = doc.y;

  //   doc.fontSize(11).font('Courier-Bold');

  //   doc.text('TOTAL:', margin, y);

  //   doc.text(totalText, margin + usableWidth - doc.widthOfString(totalText), y);

  //   doc.fontSize(10).font('Courier');

  //   doc.moveDown();

  //   // =============================
  //   // AJUSTE DINÁMICO FINAL
  //   // =============================

  //   doc.page.height = doc.y + 20;

  //   return this.buildBuffer(doc);
  // }
  async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
    const width = this.mmToPt(80);
    const marginTop = 10;
    const marginBottom = 10;
    const marginSides = 15;

    const tempDoc = new PDFDocument({
      size: [width, 1000],
      margins: {
        top: marginTop,
        left: marginSides,
        right: marginSides,
        bottom: marginBottom,
      },
    });

    tempDoc.font('Courier').fontSize(10);

    const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

    const formatMoney = (value: number): string =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: snapshot.shop.currency,
      }).format(value);

    const usableWidth = width - marginSides * 2;

    let estimatedHeight = marginTop;

    // HEADER ESTIMATION
    estimatedHeight += 50;

    // ITEMS ESTIMATION
    snapshot.items.forEach((item) => {
      const totalText = formatMoney(item.total);
      const totalWidth = tempDoc.widthOfString(totalText);
      const nameWidth = usableWidth - totalWidth - 10;

      const nameHeight = tempDoc.heightOfString(item.name, {
        width: nameWidth,
      });

      estimatedHeight += nameHeight + 25;
    });

    // Totals + spacing
    estimatedHeight += 80;

    // 🔥 Ahora sí creamos el doc real con altura exacta
    const doc = new PDFDocument({
      size: [width, estimatedHeight],
      margins: {
        top: marginTop,
        left: marginSides,
        right: marginSides,
        bottom: marginBottom,
      },
    });

    doc.font('Courier').fontSize(10);

    const margin = doc.page.margins.left;
    const usable = width - margin * 2;

    // HEADER
    doc.text(snapshot.shop.name, { align: 'center' });
    if (snapshot.shop.address)
      doc.text(snapshot.shop.address, { align: 'center' });
    if (snapshot.shop.phone)
      doc.text(`Tel: ${snapshot.shop.phone}`, { align: 'center' });

    doc.moveDown();
    doc.text(`Date: ${snapshot.saleDate.toLocaleString(locale)}`);
    doc.moveDown();

    // ITEMS
    snapshot.items.forEach((item) => {
      const totalText = formatMoney(item.total);
      const totalWidth = doc.widthOfString(totalText);
      const nameWidth = usable - totalWidth - 10;

      let y = doc.y;

      doc.text(`${item.quantity} x ${formatMoney(item.unitPrice)}`, margin, y);

      y = doc.y + 2;

      const nameHeight = doc.heightOfString(item.name, { width: nameWidth });

      doc.text(item.name, margin, y, { width: nameWidth });

      doc.text(totalText, margin + usable - totalWidth, y);

      doc.y = y + nameHeight + 5;
    });

    doc.moveDown();

    // LINE
    let line = '';
    while (doc.widthOfString(line + '-') < usable) {
      line += '-';
    }
    doc.text(line, margin);
    doc.moveDown(0.5);

    // SUBTOTAL
    const subtotalText = formatMoney(snapshot.totals.subtotal);
    let y = doc.y;

    doc.text('Subtotal:', margin, y);
    doc.text(
      subtotalText,
      margin + usable - doc.widthOfString(subtotalText),
      y,
    );

    doc.moveDown();

    // TOTAL
    const totalText = formatMoney(snapshot.totals.total);
    y = doc.y;

    doc.fontSize(11).font('Courier-Bold');
    doc.text('TOTAL:', margin, y);
    doc.text(totalText, margin + usable - doc.widthOfString(totalText), y);

    return this.buildBuffer(doc);
  }
}
