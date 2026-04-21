import { Controller, Get, Post, Body, Param, Res, NotFoundException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TicketReceiptService } from './receipt.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User } from '@/auth/entities/user.entity';
import { ShopService } from '@/shop/shop.service';

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(
    private readonly ticketReceiptService: TicketReceiptService,
    private readonly shopService: ShopService,
  ) {}

  @Get('sale/:saleId/pdf')
  async generatePdfBySaleId(
    @Param('saleId') saleId: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const receipt = await this.ticketReceiptService.findReceiptBySaleId(saleId);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    await this.shopService.assertCanAccessShop(receipt.shopId, user);

    const pdfBuffer = await this.ticketReceiptService.generatePdfFromReceipt(receipt);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=receipt-${saleId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':id/pdf')
  async generatePdf(
    @Param('id') receiptId: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const receipt = await this.ticketReceiptService.findReceiptById(receiptId);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    await this.shopService.assertCanAccessShop(receipt.shopId, user);

    const pdfBuffer = await this.ticketReceiptService.generatePdf(receiptId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=receipt-${receiptId}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('preview')
  async generatePreview(
    @Body() body: { shopId: string; overrides?: any },
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    await this.shopService.assertCanAccessShop(body.shopId, user);

    const pdfBuffer = await this.ticketReceiptService.generatePreviewPdf(
      body.shopId,
      body.overrides,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=ticket-preview.pdf',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
