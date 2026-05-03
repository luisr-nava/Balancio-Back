import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import PDFDocument from 'pdfkit';
import { ReceiptSnapshot } from '../types/receipt.types';

export class Receipt80mmGenerator implements ReceiptGenerator {
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
    return new Promise<Buffer>((resolve) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.end();
    });
  }

  async generate(snapshot: ReceiptSnapshot): Promise<Buffer> {
    const width = this.mmToPt(80);
    const marginTop = 10;
    const marginBottom = 10;
    const marginSides = 15;

    const usableWidth = width - marginSides * 2;

    const locale = snapshot.shop.countryCode === 'AR' ? 'es-AR' : 'en-US';

    const formatMoney = (value: number): string =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: snapshot.shop.currency,
      }).format(value);

    // 🔥 ENVOLVEMOS TU LÓGICA
    const render = (doc: PDFKit.PDFDocument) => {
      doc.font('Courier').fontSize(10);

      const drawSeparator = () => {
        const dashWidth = doc.widthOfString('-');
        const count = Math.floor(usableWidth / dashWidth);
        const line = '-'.repeat(count);

        doc.text(line, { width: usableWidth, align: 'center' });
      };

      // ================= HEADER =================
      doc.fontSize(12).text(snapshot.shop.name, {
        width: usableWidth,
        align: 'center',
      });

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

      doc.text(`Fecha: ${new Date(snapshot.saleDate).toLocaleString()}`, {
        width: usableWidth,
        align: 'center',
      });

      doc.moveDown();

      // ================= ITEMS =================
      snapshot.items.forEach((item) => {
        const totalText = formatMoney(item.total);
        const totalWidth = doc.widthOfString(totalText);
        const nameWidth = usableWidth - totalWidth - 10;

        // 🔥 altura real del bloque
        const textHeight = doc.heightOfString(item.name, {
          width: nameWidth,
        });

        // 🔥 posición base
        const startY = doc.y;

        // nombre (multilinea real)
        doc.text(item.name, marginSides, startY, {
          width: nameWidth,
        });

        // total alineado arriba derecha (UNA sola vez)
        doc.text(totalText, marginSides + usableWidth - totalWidth, startY, {
          lineBreak: false,
        });

        // 🔥 mover cursor correctamente (clave)
        doc.y = startY + textHeight;

        // resto igual
        doc.x = marginSides;
        doc.text(`${item.quantity} x ${formatMoney(item.unitPrice)}`, {
          width: usableWidth,
        });

        doc.moveDown(0.4);
      });

      drawSeparator();
      doc.moveDown(0.3);

      doc.text(`Subtotal: ${formatMoney(snapshot.totals.subtotal)}`, {
        width: usableWidth,
        align: 'right',
      });

      doc.moveDown(0.2);

      doc
        .font('Helvetica-Bold')
        .text(`TOTAL: ${formatMoney(snapshot.totals.total)}`, {
          width: usableWidth,
          align: 'right',
        });

      doc.moveDown(0.5);
      drawSeparator();
      doc.moveDown(0.5);

      snapshot.customFields?.forEach((field) => {
        doc.text(`${field.label}: ${field.value}`, {
          width: usableWidth,
          align: 'center',
        });
      });

      doc.moveDown(0.5);

      if (snapshot.footerMessage) {
        doc.text(snapshot.footerMessage, {
          width: usableWidth,
          align: 'center',
        });
      }
    };

    // ================= PASS 1 =================
    const docMeasure = new PDFDocument({
      size: [width, 2000],
      margins: {
        top: marginTop,
        left: marginSides,
        right: marginSides,
        bottom: marginBottom,
      },
    });

    render(docMeasure);

    // 🔥 CLAVE
    const finalHeight = docMeasure.y + marginBottom + 30;

    // ================= PASS 2 =================
    const doc = new PDFDocument({
      size: [width, finalHeight],
      margins: {
        top: marginTop,
        left: marginSides,
        right: marginSides,
        bottom: marginBottom,
      },
    });

    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    render(doc);

    doc.end();

    return await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }
}
