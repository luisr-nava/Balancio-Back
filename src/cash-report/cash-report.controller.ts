import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { CashReportService } from './cash-report.service';
import { CashReportDto } from './dto/cash-report.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { CashReportPdfService } from './cash-report-pdf.service';
import { CashReportExcelService } from './cash-report-excel.service';

import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('cash-reports')
export class CashReportController {
  constructor(
    private readonly reportService: CashReportService,
    private readonly pdfService: CashReportPdfService,
    private readonly excelService: CashReportExcelService,
  ) {}

  @Get()
  async getAll(@Query() filters: CashReportDto, @GetUser() user: JwtPayload) {
    return this.reportService.getAll(filters, user);
  }

  @Get(':id/pdf')
  async exportPdf(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const cash = await this.reportService.validateClosedCash(id, user);

    const buffer = await this.pdfService.generate(cash);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=arqueo-${id}.pdf`,
    });

    res.send(buffer);
  }

  @Get(':id/excel')
  async exportExcel(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const cash = await this.reportService.validateClosedCash(id, user);

    const buffer = await this.excelService.generate(cash);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=arqueo-${id}.xlsx`,
    });

    res.send(buffer);
  }
}
