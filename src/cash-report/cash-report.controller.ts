import { Controller, Get, Param, UseGuards, Query, Res } from '@nestjs/common';
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
  async generatePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, cash } = await this.pdfService.generate(id);

    const formattedDate = this.formatFileDate(cash.openedAt);
    const responsible = this.slugify(cash.openedByName ?? 'responsable');

    const fileName = `balanzio-cash-register-${responsible}-${formattedDate}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get(':id/excel')
  async generateExcel(@Param('id') id: string, @Res() res: Response) {
    const { buffer, cash } = await this.excelService.generate(id);

    const formattedDate = this.formatFileDate(cash.openedAt);
    const responsible = this.slugify(cash.openedByName ?? 'responsable');

    const fileName = `balanzio-cash-register-${responsible}-${formattedDate}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  private formatFileDate(date: Date): string {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
  }
}
