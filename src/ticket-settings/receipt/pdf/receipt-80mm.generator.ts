import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';

export class Receipt80mmGenerator implements ReceiptGenerator {
  private mmToPt(mm: number): number {
    return mm * 2.834;
  }

  private splitTextToSize(
    doc: PDFKit.PDFDocument,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (doc.widthOfString(word) > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        let fragment = '';
        for (const char of word) {
          const testFragment = fragment + char;
          if (doc.widthOfString(testFragment) <= maxWidth) {
            fragment = testFragment;
          } else {
            if (fragment) lines.push(fragment);
            fragment = char;
          }
        }
        if (fragment) {
          if (currentLine && doc.widthOfString(currentLine + ' ' + fragment) <= maxWidth) {
            currentLine = currentLine + ' ' + fragment;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = fragment;
          }
        }
      } else {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (doc.widthOfString(testLine) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
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

const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

const formatMoney = (value: number): string =>
new Intl.NumberFormat(locale, {
style: 'currency',
currency: snapshot.shop.currency,
}).format(value);

const doc = new PDFDocument({
size: [width, 1000],
margins: { top: marginTop, left: marginSides, right: marginSides, bottom: marginBottom },
});

const usableWidth = width - marginSides * 2;

doc.font('Courier').fontSize(10);

  const drawSeparator = () => {
    const margin = doc.page.margins.left;
    const pageWidth = doc.page.width;
    const rightMargin = doc.page.margins.right;
    const startX = margin;
    const endX = pageWidth - rightMargin;
    const y = doc.y + 2;
    doc.moveTo(startX, y)
      .lineTo(endX, y)
      .stroke();
  };

doc.text(snapshot.shop.name, { width: usableWidth, align: 'center' });
if (snapshot.shop.address)
doc.text(snapshot.shop.address, { width: usableWidth, align: 'center' });
if (snapshot.shop.phone && snapshot.showPhone !== false)
doc.text(`Tel: ${snapshot.shop.phone}`, { width: usableWidth, align: 'center' });
if (snapshot.shop.taxId)
doc.text(snapshot.shop.taxId, { width: usableWidth, align: 'center' });
if (snapshot.shop.email && snapshot.showEmail !== false)
doc.text(snapshot.shop.email, { width: usableWidth, align: 'center' });
if (snapshot.shop.website && snapshot.showWebsite !== false)
doc.text(snapshot.shop.website, { width: usableWidth, align: 'center' });

doc.moveDown();
doc.text(`Fecha: ${snapshot.saleDate.toLocaleString(locale)}`, { width: usableWidth });
doc.moveDown();

const margin = doc.page.margins.left;
const nameX = margin;
const totalX = margin + usableWidth;

  const layout = snapshot.layout?.items;
  const itemMode = layout?.mode ?? 'two-lines';
  const showUnitPrice = layout?.showUnitPrice ?? true;

  snapshot.items.forEach((item) => {
    const totalText = formatMoney(item.total);
    const totalWidth = doc.widthOfString(totalText);

    if (itemMode === 'single-line') {
      const line = `${item.quantity} x ${item.name}`;
      const y = doc.y;
      doc.text(line, nameX, y, { width: usableWidth - totalWidth - 5 });
      doc.text(totalText, totalX - totalWidth, y);
      doc.y = y + doc.currentLineHeight() + 2;
    } else {
      const y = doc.y;
      const nameWidth = usableWidth - totalWidth;
      const nameHeight = doc.heightOfString(item.name, { width: nameWidth });

      doc.text(item.name, nameX, y, { width: nameWidth });
      doc.text(totalText, totalX - totalWidth, y);
      doc.y = y + nameHeight + 2;

      if (showUnitPrice) {
        const detailY = doc.y;
        doc.text(`${item.quantity} x ${formatMoney(item.unitPrice)}`, nameX, detailY, { width: usableWidth });
        doc.y = detailY + doc.currentLineHeight() + 4;
      } else {
        doc.y += 4;
      }
    }
  });

doc.moveDown(0.5);
drawSeparator();
doc.moveDown(0.5);

  const totalsMargin = doc.page.margins.left;
  const totalsUsableWidth = doc.page.width - totalsMargin - doc.page.margins.right;
  const subtotalText = `Subtotal: ${formatMoney(snapshot.totals.subtotal)}`;
  const totalText = `TOTAL: ${formatMoney(snapshot.totals.total)}`;

  doc.text(
    subtotalText,
    totalsMargin + totalsUsableWidth - doc.widthOfString(subtotalText),
    doc.y
  );
  doc.moveDown(0.3);
  doc.fontSize(11).font('Courier-Bold');
  doc.text(
    totalText,
    totalsMargin + totalsUsableWidth - doc.widthOfString(totalText),
    doc.y
  );
  doc.fontSize(10).font('Courier');
  doc.moveDown(0.5);

  if (snapshot.customFields && snapshot.customFields.length > 0) {
    drawSeparator();
    snapshot.customFields.forEach((field) => {
      doc.text(`${field.label}: ${field.value}`, { width: totalsUsableWidth, align: 'center' });
    });
  }

  if (snapshot.footerMessage) {
    doc.text(snapshot.footerMessage, { width: totalsUsableWidth, align: 'center' });
  }

    doc.page.height = doc.y + 20;

    return this.buildBuffer(doc);
}
}
