import { Module } from '@nestjs/common';
import { CashReportService } from './cash-report.service';
import { CashReportController } from './cash-report.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';
import { CashReportPdfService } from './cash-report-pdf.service';
import { CashReportExcelService } from './cash-report-excel.service';
import { ShopModule } from '@/shop/shop.module';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashRegister, CashMovement]), ShopModule],
  controllers: [CashReportController],
  providers: [CashReportService, CashReportPdfService, CashReportExcelService],
})
export class CashReportModule {}
