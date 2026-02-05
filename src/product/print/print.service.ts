import { Injectable } from '@nestjs/common';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

type PDFKitDocument = InstanceType<typeof PDFDocument>;
type PrintOptions = {
  format: 'A4' | 'THERMAL';
  copies: number;
};

type PrintableBarcode = {
  barcode: string;
  productName: string;
  shopName: string;
};

@Injectable()
export class PrintService {
  async generateBarcodePdf(
    items: PrintableBarcode[],
    options: PrintOptions,
  ): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: options.format === 'A4' ? 'A4' : [226, 600], // 80mm térmica
          margin: 30,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        if (options.format === 'A4') {
          await this.renderA4(doc, items, options.copies);
        } else {
          await this.renderThermal(doc, items, options.copies);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async renderA4(
    doc: PDFKitDocument,
    items: PrintableBarcode[],
    copies: number,
  ) {
    const PAGE_WIDTH =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const LABEL_WIDTH = 142; // ~5cm
    const LABEL_HEIGHT = 120;
    const GAP_X = 10;
    const GAP_Y = 10;

    const COLUMNS = Math.floor(PAGE_WIDTH / (LABEL_WIDTH + GAP_X));

    const STORE_HEIGHT = 10;
    const PRODUCT_HEIGHT = 14;
    const BARCODE_BOX_HEIGHT = 50;
    const CODE_HEIGHT = 10;
    const TOP_PADDING = 6;

    let x = doc.page.margins.left;
    let y = doc.page.margins.top;
    let col = 0;

    for (const item of items) {
      for (let c = 0; c < copies; c++) {
        const barcodePng = await this.generateBarcodeImage(item.barcode);

        let cursorY = y + TOP_PADDING;

        // 🏪 TIENDA
        doc.fontSize(7).fillColor('gray').text(item.shopName, x, cursorY, {
          width: LABEL_WIDTH,
          align: 'center',
          height: STORE_HEIGHT,
        });
        cursorY += STORE_HEIGHT;

        // 🏷 PRODUCTO
        doc.fontSize(9).fillColor('black').text(item.productName, x, cursorY, {
          width: LABEL_WIDTH,
          align: 'center',
          height: PRODUCT_HEIGHT,
        });
        cursorY += PRODUCT_HEIGHT;

        // 📦 BARCODE (CAJA FIJA)
        doc.image(barcodePng, x + 8, cursorY, {
          fit: [LABEL_WIDTH - 16, BARCODE_BOX_HEIGHT],
          align: 'center',
        });
        cursorY += BARCODE_BOX_HEIGHT;

        // 🔢 CÓDIGO
        doc.fontSize(8).fillColor('black').text(item.barcode, x, cursorY, {
          width: LABEL_WIDTH,
          align: 'center',
          height: CODE_HEIGHT,
        });

        // 👉 siguiente columna
        col++;
        x += LABEL_WIDTH + GAP_X;

        if (col >= COLUMNS) {
          col = 0;
          x = doc.page.margins.left;
          y += LABEL_HEIGHT + GAP_Y;

          if (y + LABEL_HEIGHT > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            y = doc.page.margins.top;
          }
        }
      }
    }
  }

  private async renderThermal(
    doc: PDFKitDocument,
    items: PrintableBarcode[],
    copies: number,
  ) {
    for (const item of items) {
      for (let i = 0; i < copies; i++) {
        const barcodePng = await this.generateBarcodeImage(item.barcode);

        doc.fontSize(11).text(item.productName, { align: 'center' });
        doc.fontSize(9).fillColor('gray').text(item.shopName, {
          align: 'center',
        });

        doc.moveDown(0.3);

        doc.image(barcodePng, {
          align: 'center',
          width: 180,
        });

        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('black').text(item.barcode, {
          align: 'center',
        });

        doc.addPage();
      }
    }
  }

  private async generateBarcodeImage(barcode: string): Promise<Buffer> {
    return bwipjs.toBuffer({
      bcid: 'code128',
      text: barcode,
      scale: 3,
      height: 14,
      includetext: false, 
    });
  }
}
