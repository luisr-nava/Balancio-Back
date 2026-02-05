import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PrintService } from './print.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PrintBarcodesDto } from './dto/print-barcodes.dto';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ShopProduct } from '../entities/shop-product.entity';
import { PrintPriceLabelsDto } from './dto/print-price-labels.dto';

@Controller('print')
export class PrintController {
  constructor(
    private readonly printService: PrintService,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,
  ) {}

  @Get('barcode/:code')
  async printSingleBarcode(@Param('code') code: string, @Res() res: Response) {
    const pdf = await this.printService.generateBarcodePdf(
      [
        {
          barcode: code,
          productName: 'Producto',
          shopName: '',
        },
      ],
      {
        format: 'A4',
        copies: 1,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="barcode-${code}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);

    res.end(pdf);
  }

  @UseGuards(JwtAuthGuard)
  @Post('barcodes')
  async printBarcodes(@Body() dto: PrintBarcodesDto, @Res() res: Response) {
    const shopProducts = await this.shopProductRepository.find({
      where: { id: In(dto.shopProductIds) },
      relations: {
        product: true,
        shop: true,
      },
    });

    if (!shopProducts.length) {
      throw new NotFoundException('No se encontraron productos para imprimir');
    }

    const items = shopProducts.map((sp) => ({
      barcode: sp.barcode,
      productName: sp.product.name,
      shopName: sp.shop.name,
    }));

    const pdf = await this.printService.generateBarcodePdf(items, {
      format: dto.format,
      copies: dto.copies ?? 1,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="barcodes-${Date.now()}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);

    res.end(pdf);
  }

  @Post('price-labels')
  async printPriceLabels(
    @Body() dto: PrintPriceLabelsDto,
    @Res() res: Response,
  ) {
    const shopProducts = await this.shopProductRepository.find({
      where: { id: In(dto.shopProductIds) },
      relations: {
        product: true,
        shop: true,
      },
    });

    if (!shopProducts.length) {
      throw new NotFoundException(
        'No se encontraron productos para imprimir etiquetas',
      );
    }

    const items = shopProducts.map((sp) => ({
      productName: sp.product.name,
      shopName: sp.shop.name,
      price: sp.salePrice,
      currency: sp.currency,
      barcode: sp.barcode,
    }));

    const pdf = await this.printService.generatePriceLabelsPdf(items, {
      copies: dto.copies ?? 1,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="price-labels-${Date.now()}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);

    res.end(pdf);
  }
}
