import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type PDFKit from 'pdfkit';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';

@Injectable()
export class CashReportPdfService {
  async generate(cash: CashRegister) {
    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      content: [
        { text: 'Arqueo de Caja', fontSize: 18, bold: true },
        { text: `Tienda: ${cash.shop.name}` },
        { text: `Empleado: ${cash.openedByName}` },
        { text: `Fecha Apertura: ${cash.openedAt}` },
        { text: `Fecha Cierre: ${cash.closedAt}` },
        { text: `Monto Apertura: ${cash.openingAmount}` },
        { text: `Esperado: ${cash.closingAmount}` },
        { text: `Real: ${cash.actualAmount}` },
        { text: `Diferencia: ${cash.difference}` },
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (error: Error) => reject(error));

      pdfDoc.end();
    });
  }
}
