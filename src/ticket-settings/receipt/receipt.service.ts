import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SaleReceipt } from './entities/receipt.entity';
import { EntityManager, Repository } from 'typeorm';
import { Sale } from '@/sale/entities/sale.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { ReceiptPaperSize, ReceiptSnapshot } from './types/receipt.types';
import { ReceiptSnapshotBuilder } from './builders/receipt-snapshot.builder';
import { ReceiptPdfFactory } from './pdf/receipt-pdf.factory';
import { TicketSettingsService } from '../ticket-settings.service';

@Injectable()
export class TicketReceiptService {
  constructor(
    @InjectRepository(SaleReceipt)
    private readonly receiptRepo: Repository<SaleReceipt>,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    @Inject(forwardRef(() => TicketSettingsService))
    private readonly ticketSettingsService: TicketSettingsService,
  ) {}

  async createReceipt(
    manager: EntityManager,
    sale: Sale,
    shop: Shop,
    receiptNumber: number | bigint,
  ): Promise<SaleReceipt> {
    const ticketSettings = await this.ticketSettingsService.getSettingsByShopId(shop.id);
    const paperSize = ticketSettings?.paperSize ?? ReceiptPaperSize.MM_80;
    const snapshot: ReceiptSnapshot = ReceiptSnapshotBuilder.build(sale, shop, ticketSettings);

    const receipt = manager.create(SaleReceipt, {
      saleId: sale.id,
      shopId: shop.id,
      snapshot,
      receiptNumber: receiptNumber.toString(),
      paperSize,
    });

    return manager.save(SaleReceipt, receipt);
  }

  async findReceiptById(receiptId: string): Promise<SaleReceipt | null> {
    return this.receiptRepo.findOne({ where: { id: receiptId } });
  }

  async findReceiptBySaleId(saleId: string): Promise<SaleReceipt | null> {
    return this.receiptRepo.findOne({ where: { saleId } });
  }

  async generatePdf(receiptId: string): Promise<Buffer> {
    const receipt = await this.receiptRepo.findOne({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    const generator = ReceiptPdfFactory.create(receipt.paperSize);
    return generator.generate(receipt.snapshot);
  }

  async generatePreviewPdf(shopId: string, overrides?: any): Promise<Buffer> {
    const shop = await this.getShopForPreview(shopId);
    const baseSettings = await this.ticketSettingsService.getSettingsByShopId(shopId);
    const ticketSettings = { ...baseSettings, ...overrides } as typeof baseSettings;
    const paperSize = ticketSettings?.paperSize ?? ReceiptPaperSize.MM_80;

    const mockSale = {
      id: 'preview',
      saleDate: new Date(),
      paymentStatus: 'PAID' as any,
      subtotal: 5500,
      taxAmount: 0,
      totalAmount: 5500,
      items: [
        { productName: 'Producto ejemplo', quantity: '2', unitPrice: 1500, total: 3000, shopProductId: null, barcode: null },
        { productName: 'Otro producto', quantity: '1', unitPrice: 2500, total: 2500, shopProductId: null, barcode: null },
      ],
    } as unknown as Sale;

    const snapshot = ReceiptSnapshotBuilder.build(mockSale, shop, ticketSettings);

    const generator = ReceiptPdfFactory.create(paperSize);
    return generator.generate(snapshot);
  }

  async generatePdfFromReceipt(receipt: SaleReceipt): Promise<Buffer> {
    const generator = ReceiptPdfFactory.create(receipt.paperSize);
    return generator.generate(receipt.snapshot);
  }

  private async getShopForPreview(shopId: string): Promise<Shop> {
    const shop = await this.shopRepo?.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    return shop;
  }
}
