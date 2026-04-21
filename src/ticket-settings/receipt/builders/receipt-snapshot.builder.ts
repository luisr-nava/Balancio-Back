import { ReceiptSnapshot } from '../types/receipt.types';
import { Sale } from '@/sale/entities/sale.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { ShopTicketSettings } from '../../entities/shop-ticket-settings.entity';

export class ReceiptSnapshotBuilder {
  static build(
    sale: Sale,
    shop: Shop,
    ticketSettings: ShopTicketSettings | null,
  ): ReceiptSnapshot {
    return {
      shop: {
        name: ticketSettings?.businessName ?? shop.name,
        address: ticketSettings?.address ?? shop.address ?? null,
        phone: ticketSettings?.phone ?? shop.phone ?? null,
        taxId: ticketSettings?.taxId ?? null,
        email: ticketSettings?.email ?? null,
        website: ticketSettings?.website ?? null,
        currency: shop.currency,
        timezone: shop.timezone,
        countryCode: shop.countryCode,
      },
      saleId: sale.id,
      saleDate: sale.saleDate,
      items: sale.items.map((i) => ({
        name: i.productName ?? 'Producto eliminado',
        quantity: Number(i.quantity ?? 0),
        unitPrice: Number(i.unitPrice ?? 0),
        total: Number(i.total ?? Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0)),
        productId: i.shopProductId ?? null,
        barcode: i.barcode ?? null,
      })),
      totals: {
        subtotal: Number(sale.subtotal ?? 0),
        tax: Number(sale.taxAmount ?? 0),
        total: Number(sale.totalAmount ?? 0),
      },
      payment: {
        status: sale.paymentStatus,
      },
      metadata: {
        receiptType: 'STANDARD',
        generatedAt: new Date(),
      },
      footerMessage: ticketSettings?.footerMessage ?? null,
      customFields: (ticketSettings?.customFields ?? []).filter(
        (f) => f.label?.trim() && f.value?.trim(),
      ),
      showPhone: ticketSettings?.showPhone ?? true,
      showEmail: ticketSettings?.showEmail ?? true,
      showWebsite: ticketSettings?.showWebsite ?? true,
      layout: ticketSettings?.layout,
    };
  }
}
