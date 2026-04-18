import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SaleReceipt } from './entities/receipt.entity';
import { EntityManager, Repository } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { ReceiptPaperSize, ReceiptSnapshot } from './types/receipt.types';
import { ReceiptSnapshotBuilder } from './builders/receipt-snapshot.builder';
import { ReceiptPdfFactory } from './pdf/receipt-pdf.factory';
import { TicketSettingsService } from '@/ticket-settings/ticket-settings.service';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(SaleReceipt)
    private readonly receiptRepo: Repository<SaleReceipt>,
    private readonly ticketSettingsService: TicketSettingsService,
  ) {}
  async createReceipt(
    manager: EntityManager,
    sale: Sale,
    shop: Shop,
    receiptNumber: number | bigint,
    paperSize?: ReceiptPaperSize,
  ): Promise<SaleReceipt> {
    const ticketSettings = await this.ticketSettingsService.getSettingsByShopId(shop.id);
    const effectivePaperSize = paperSize ?? ticketSettings?.paperSize ?? ReceiptPaperSize.MM_80;
    const snapshot: ReceiptSnapshot = ReceiptSnapshotBuilder.build(sale, shop, ticketSettings);

    const receipt = manager.create(SaleReceipt, {
      saleId: sale.id,
      shopId: shop.id,
      snapshot,
      receiptNumber: receiptNumber.toString(),
      paperSize: effectivePaperSize,
    });

    return manager.save(SaleReceipt, receipt);
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
}
