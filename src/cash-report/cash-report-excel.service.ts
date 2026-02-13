import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';

@Injectable()
export class CashReportExcelService {
  async generate(cash: CashRegister) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Arqueo');

    sheet.addRow(['Arqueo de Caja']);
    sheet.addRow([]);
    sheet.addRow(['Tienda', cash.shop.name]);
    sheet.addRow(['Empleado', cash.employeeId]);
    sheet.addRow(['Fecha Apertura', cash.openedAt]);
    sheet.addRow(['Fecha Cierre', cash.closedAt]);
    sheet.addRow(['Monto Apertura', Number(cash.openingAmount)]);
    sheet.addRow(['Esperado', Number(cash.closingAmount)]);
    sheet.addRow(['Real', Number(cash.actualAmount)]);
    sheet.addRow(['Diferencia', Number(cash.difference)]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
