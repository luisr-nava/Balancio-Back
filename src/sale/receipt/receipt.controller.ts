import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ReceiptService } from './receipt.service';

@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get(':id/pdf')
  async generatePdf(@Param('id') receiptId: string, @Res() res: Response) {
    const pdfBuffer = await this.receiptService.generatePdf(receiptId);

    if (!pdfBuffer) {
      throw new NotFoundException('Receipt not found');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=receipt-${receiptId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
