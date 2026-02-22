import { ReceiptGenerator } from '../interfaces/receipt-generator.interface';
import { ReceiptPaperSize } from '../types/receipt.types';
import { Receipt58mmGenerator } from './receipt-58mm.generator';

import { Receipt80mmGenerator } from './receipt-80mm.generator';
import { ReceiptA4Generator } from './receipt-a4.generator';

export class ReceiptPdfFactory {
  static create(paperSize: ReceiptPaperSize): ReceiptGenerator {
    switch (paperSize) {
      case '58mm':
        return new Receipt58mmGenerator();

      case '80mm':
        return new Receipt80mmGenerator();

      case 'A4':
        return new ReceiptA4Generator();

      default:
        // Esto nunca debería pasar porque ReceiptPaperSize está tipado,
        // pero lo dejamos por seguridad futura.
        throw new Error(`Unsupported paper size: ${paperSize}`);
    }
  }
}
