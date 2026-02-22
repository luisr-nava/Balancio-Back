import { ReceiptSnapshot } from '../types/receipt.types';
import { Sale } from '../../entities/sale.entity';
import { Shop } from '@/shop/entities/shop.entity';

export class ReceiptSnapshotBuilder {
  static build(sale: Sale, shop: Shop): ReceiptSnapshot {
    return {
      shop: {
        name: shop.name,
        address: shop.address ?? null,
        phone: shop.phone ?? null,
        currency: shop.currency,
        timezone: shop.timezone,
        countryCode: shop.countryCode,
      },
      saleId: sale.id,
      saleDate: sale.saleDate,
      items: sale.items.map((i) => ({
        name: i.shopProduct.product.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      })),
      totals: {
        subtotal: Number(sale.subtotal),
        tax: Number(sale.taxAmount),
        total: Number(sale.totalAmount),
      },
      payment: {
        status: sale.paymentStatus,
      },
      metadata: {
        receiptType: 'STANDARD',
        generatedAt: new Date(),
      },
    };
  }
}
