import { ReceiptSnapshot } from '../types/receipt.types';

export interface ReceiptGenerator {
  generate(snapshot: ReceiptSnapshot): Promise<Buffer>;
}
