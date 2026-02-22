export enum ReceiptPaperSize {
  MM_58 = '58mm',
  MM_80 = '80mm',
  A4 = 'A4',
}
export type ReceiptType = 'STANDARD' | 'FISCAL';

export interface ReceiptShopSnapshot {
  name: string;
  address?: string | null;
  phone?: string | null;
  currency: string;
  timezone: string;
  countryCode: string;
}

export interface ReceiptItemSnapshot {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptTotalsSnapshot {
  subtotal: number;
  tax: number;
  total: number;
}

export interface ReceiptPaymentSnapshot {
  status: string;
}

export interface ReceiptMetadataSnapshot {
  receiptType: ReceiptType;
  generatedAt: Date;
}

export interface ReceiptSnapshot {
  shop: ReceiptShopSnapshot;
  saleId: string;
  saleDate: Date;
  items: ReceiptItemSnapshot[];
  totals: ReceiptTotalsSnapshot;
  payment: ReceiptPaymentSnapshot;
  metadata: ReceiptMetadataSnapshot;
}
