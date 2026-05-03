import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';
// const width = 58 * 2.834;

export class Receipt58mmGenerator implements ReceiptGenerator {
  private mmToPt(mm: number): number {
    return mm * 2.834;
  }

  // private splitTextToSize(
  //   doc: PDFKit.PDFDocument,
  //   text: string,
  //   maxWidth: number,
  // ): string[] {
  //   const words = text.split(/\s+/);
  //   const lines: string[] = [];
  //   let currentLine = '';

  //   for (const word of words) {
  //     if (doc.widthOfString(word) > maxWidth) {
  //       if (currentLine) {
  //         lines.push(currentLine);
  //         currentLine = '';
  //       }
  //       let fragment = '';
  //       for (const char of word) {
  //         const testFragment = fragment + char;
  //         if (doc.widthOfString(testFragment) <= maxWidth) {
  //           fragment = testFragment;
  //         } else {
  //           if (fragment) lines.push(fragment);
  //           fragment = char;
  //         }
  //       }
  //       if (fragment) {
  //         if (
  //           currentLine &&
  //           doc.widthOfString(currentLine + ' ' + fragment) <= maxWidth
  //         ) {
  //           currentLine = currentLine + ' ' + fragment;
  //         } else {
  //           if (currentLine) lines.push(currentLine);
  //           currentLine = fragment;
  //         }
  //       }
  //     } else {
  //       const testLine = currentLine ? `${currentLine} ${word}` : word;
  //       if (doc.widthOfString(testLine) <= maxWidth) {
  //         currentLine = testLine;
  //       } else {
  //         if (currentLine) lines.push(currentLine);
  //         currentLine = word;
  //       }
  //     }
  //   }
  //   if (currentLine) lines.push(currentLine);
  //   return lines.length > 0 ? lines : [''];
  // }

  private buildBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.end();
    });
  }
  async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
    const width = this.mmToPt(58);
    const margin = 10;
    const usableWidth = width - margin * 2;

    const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

    const formatMoney = (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: snapshot.shop.currency,
      }).format(value);

    // ================= RENDER FUNC =================
    const render = (doc: PDFKit.PDFDocument) => {
      doc.font('Courier').fontSize(9);

      const drawSeparator = () => {
        doc
          .moveTo(margin, doc.y)
          .lineTo(margin + usableWidth, doc.y)
          .stroke();
      };

      // HEADER
      doc.text(snapshot.shop.name, { width: usableWidth, align: 'center' });

      if (snapshot.shop.address)
        doc.text(snapshot.shop.address, {
          width: usableWidth,
          align: 'center',
        });

      if (snapshot.shop.phone && snapshot.showPhone !== false)
        doc.text(`Tel: ${snapshot.shop.phone}`, {
          width: usableWidth,
          align: 'center',
        });

      if (snapshot.shop.email && snapshot.showEmail !== false)
        doc.text(`Email: ${snapshot.shop.email}`, {
          width: usableWidth,
          align: 'center',
        });

      if (snapshot.shop.website && snapshot.showWebsite !== false)
        doc.text(`Web: ${snapshot.shop.website}`, {
          width: usableWidth,
          align: 'center',
        });

      doc.moveDown();

      // META
      doc.text(`Fecha: ${snapshot.saleDate.toLocaleString(locale)}`, {
        width: usableWidth,
      });

      doc.moveDown();

      // ITEMS
      const nameX = margin;
      const totalX = margin + usableWidth;

      const itemMode = snapshot.layout?.items?.mode ?? 'two-lines';
      const showUnitPrice = snapshot.layout?.items?.showUnitPrice ?? true;

      snapshot.items.forEach((item) => {
        const totalText = formatMoney(item.total);
        const totalWidth = doc.widthOfString(totalText);

        if (itemMode === 'single-line') {
          const y = doc.y;

          doc.text(`${item.quantity} x ${item.name}`, nameX, y, {
            width: usableWidth - totalWidth - 5,
          });

          doc.text(totalText, totalX - totalWidth, y);

          doc.y = y + doc.currentLineHeight() + 2;
        } else {
          const y = doc.y;
          const nameWidth = usableWidth - totalWidth;

          const nameHeight = doc.heightOfString(item.name, {
            width: nameWidth,
          });

          doc.text(item.name, nameX, y, { width: nameWidth });
          doc.text(totalText, totalX - totalWidth, y);

          doc.y = y + nameHeight + 2;

          if (showUnitPrice) {
            const detailY = doc.y;

            doc.text(
              `${item.quantity} x ${formatMoney(item.unitPrice)}`,
              nameX,
              detailY,
              { width: usableWidth },
            );

            doc.y = detailY + doc.currentLineHeight() + 4;
          } else {
            doc.y += 4;
          }
        }
      });

      // TOTALS
      doc.moveDown(0.5);
      drawSeparator();
      doc.moveDown(0.5);

      const rightEdge = doc.page.width - doc.page.margins.right;

      const subtotalText = `Subtotal: ${formatMoney(snapshot.totals.subtotal)}`;
      const totalText = `TOTAL: ${formatMoney(snapshot.totals.total)}`;

      doc.text(
        subtotalText,
        rightEdge - doc.widthOfString(subtotalText) - 5,
        doc.y,
      );

      doc.moveDown(0.3);

      doc.fontSize(11).font('Courier-Bold');

      doc.text(totalText, rightEdge - doc.widthOfString(totalText) - 5, doc.y);

      doc.fontSize(9).font('Courier');
      doc.moveDown(0.5);

      // CUSTOM FIELDS
      if (snapshot.customFields?.length) {
        drawSeparator();
        doc.moveDown(0.5);

        doc.x = doc.page.margins.left;

        snapshot.customFields.forEach((f) => {
          doc.text(`${f.label}: ${f.value}`, {
            width: usableWidth,
            align: 'center',
          });
        });
      }

      // FOOTER
      if (snapshot.footerMessage) {
        doc.moveDown();
        doc.x = doc.page.margins.left;

        doc.text(snapshot.footerMessage, {
          width: usableWidth,
          align: 'center',
        });
      }
    };

    // ================= PASO 1: MEDIR =================
    const tempDoc = new PDFDocument({
      size: [width, 10000],
      margins: { top: 10, left: margin, right: margin, bottom: 10 },
    });

    render(tempDoc);

    const finalHeight = Math.max(tempDoc.y + 40, 200);

    // ================= PASO 2: FINAL =================
    const doc = new PDFDocument({
      size: [width, finalHeight],
      margins: { top: 10, left: margin, right: margin, bottom: 10 },
    });

    render(doc);

    return this.buildBuffer(doc);
  }
}
