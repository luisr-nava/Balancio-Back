import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { existsSync, readFileSync } from 'fs';
import path from 'node:path';

import {
  CashRegister,
  CashMovementType,
} from '@/cash-register/entities/cash-register.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';

@Injectable()
export class CashReportExcelService {
  private logoBuffer: Buffer | null = null;

  constructor(
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,

    @InjectRepository(CashMovement)
    private readonly cashMovementRepository: Repository<CashMovement>,
  ) {}

  async generate(cashRegisterId: string): Promise<{
    buffer: Buffer;
    cash: CashRegister;
  }> {
    const cash = await this.cashRegisterRepository.findOne({
      where: { id: cashRegisterId },
      relations: ['shop'],
    });

    if (!cash) {
      throw new Error('Cash register not found');
    }

    const movements = await this.cashMovementRepository.find({
      where: { cashRegisterId: cash.id },
      relations: ['sale', 'purchase', 'saleReturn', 'income', 'expense'],
      order: { createdAt: 'ASC' },
    });

    const workbook = new ExcelJS.Workbook();
    const currency = cash.shop.currency ?? 'USD';
    const currencyFormat = this.getCurrencyFormat(currency);

    this.buildSummarySheet(workbook, cash, movements, currencyFormat);
    this.buildMovementsSheet(workbook, cash, movements, currencyFormat);

    const bufferRaw = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(bufferRaw),
      cash,
    };
  }

  // =========================
  // SUMMARY SHEET (LEGACY 1:1)
  // =========================

  private async buildSummarySheet(
    workbook: ExcelJS.Workbook,
    cash: CashRegister,
    movements: CashMovement[],
    currencyFormat: string,
  ) {
    const sheet = workbook.addWorksheet('Resumen');

    const totals = this.calculateTotals(cash, movements);

    // HEADER
    for (let i = 1; i <= 4; i++) {
      sheet.getRow(i).height = 20;
    }

    sheet.mergeCells('A1:A4');
    this.insertLogo(sheet, {
      tlCol: 0.3,
      tlRow: 0.5,
      width: 140,
      height: 70,
    });
    sheet.getColumn('A').width = 30;

    sheet.mergeCells('B1:J1');
    const titleCell = sheet.getCell('B1');
    titleCell.value = 'Arqueo de Caja';
    titleCell.font = {
      name: 'Calibri',
      size: 18,
      bold: true,
      color: { argb: 'FF1E3A8A' },
    };
    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    sheet.mergeCells('B2:J4');
    const infoCell = sheet.getCell('B2');
    infoCell.value =
      `Tienda: ${cash.shop.name}\n` +
      `Fecha: ${this.formatDateOnly(cash.openedAt)}\n` +
      `Responsable: ${cash.openedByName ?? 'N/D'}`;

    infoCell.font = { name: 'Calibri', size: 14 };
    infoCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    // TABLA
    sheet.addRow([]);

    sheet.getColumn('B').width = 24;
    sheet.getColumn('C').width = 24;
    sheet.getColumn('D').width = 24;
    sheet.getColumn('E').width = 24;
    sheet.getColumn('F').width = 24;
    sheet.getColumn('G').width = 24;
    sheet.getColumn('H').width = 24;
    sheet.getColumn('I').width = 24;
    sheet.getColumn('J').width = 24;

    const tableHeader = sheet.addRow([
      'Fecha',
      'Hora de apertura',
      'Monto de apertura',
      'Total ingresos',
      'Total egresos',
      'Balance esperado',
      'Balance real',
      'Diferencia',
      'Hora de cierre',
      'Total en caja',
    ]);

    tableHeader.font = { bold: true, name: 'Calibri', size: 13 };

    tableHeader.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const opened = this.splitDateTime(cash.openedAt);
    const closed = cash.closedAt ? this.splitDateTime(cash.closedAt) : null;

    const dataRow = sheet.addRow([
      this.formatDateOnly(cash.openedAt),
      opened.time,
      totals.openingAmount,
      totals.totalIncome,
      totals.totalExpense,
      totals.expectedAmount,
      totals.actualAmount,
      totals.difference,
      closed?.time ?? '-',
      totals.actualAmount,
    ]);

    dataRow.eachCell((cell, col) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if ([3, 4, 5, 6, 7, 8, 10].includes(col)) {
        cell.numFmt = currencyFormat;
      }

      if (col === 8 && typeof cell.value === 'number' && cell.value < 0) {
        cell.font = { color: { argb: 'FFDC2626' } };
      }
    });

    sheet.views = [{ state: 'frozen', ySplit: tableHeader.number }];

    // this.unlockSheetCells(sheet);
    // const lockColumns = Math.max(sheet.columnCount, 10);
    // this.lockCellRange(sheet, 1, 1, tableHeader.number, lockColumns);
    await this.protectSheet(sheet);
  }

  // =========================
  // MOVEMENTS SHEET (LEGACY 1:1)
  // =========================

  private async buildMovementsSheet(
    workbook: ExcelJS.Workbook,
    cash: CashRegister,
    movements: CashMovement[],
    currencyFormat: string,
  ) {
    const sheet = workbook.addWorksheet('Movimientos');

    const formattedDate = this.formatDateOnly(new Date());

    for (let i = 1; i <= 4; i++) {
      sheet.getRow(i).height = 20;
    }

    sheet.mergeCells('A1:A4');
    this.insertLogo(sheet, {
      tlCol: 0.3,
      tlRow: 0.5,
      width: 140,
      height: 70,
    });
    sheet.getColumn('A').width = 30;

    sheet.mergeCells('B1:E1');
    const titleCell = sheet.getCell('B1');
    titleCell.value = 'Detalle de movimientos';
    titleCell.font = { name: 'Calibri', size: 18, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.getColumn('B').width = 20;
    sheet.getColumn('C').width = 20;
    sheet.getColumn('D').width = 40;
    sheet.getColumn('E').width = 40;

    sheet.mergeCells('B2:E4');
    const infoCell = sheet.getCell('B2');
    infoCell.value =
      `Tienda: ${cash.shop.name}\n` +
      `Fecha: ${formattedDate}\n` +
      `Responsable: ${cash.openedByName ?? 'No disponible'}`;
    infoCell.font = { name: 'Calibri', size: 14 };
    infoCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    const header = sheet.addRow([]);
    header.hidden = true;
    sheet.addRow([]);

    const tableHeader = sheet.addRow([
      'Fecha',
      'Hora',
      'Tipo',
      'Referencia',
      'Monto',
    ]);
    tableHeader.font = { bold: true, name: 'Calibri', size: 14 };

    sheet.views = [{ state: 'frozen', ySplit: tableHeader.number }];

    movements.forEach((movement) => {
      const { date, time } = this.splitDateTime(movement.createdAt);

      const amount =
        movement.type === CashMovementType.OPENING
          ? movement.amount
          : this.getSignedAmount(movement.type, movement.amount);

      const row = sheet.addRow([
        date,
        time,
        this.mapMovementType(movement.type),
        this.getMovementReference(movement),
        amount,
      ]);

      row.getCell(5).numFmt = currencyFormat;

      if (amount < 0) {
        row.getCell(5).font = { color: { argb: 'FFDC2626' } };
      }
    });

    if (cash.closedAt) {
      const { date, time } = this.splitDateTime(cash.closedAt);

      const closeRow = sheet.addRow([
        date,
        time,
        'Cierre',
        'Cierre de caja',
        cash.actualAmount ?? 0,
      ]);

      closeRow.getCell(5).numFmt = currencyFormat;
      closeRow.font = { bold: true };
      closeRow.getCell(5).font = {
        bold: true,
        color: { argb: 'FF16A34A' },
      };
    }

    const lockColumns = Math.max(sheet.columnCount, 7);
    const headerRowsToLock = 4;
    await this.protectSheet(sheet);
  }

  // =========================
  // CALCULATIONS
  // =========================

  private calculateTotals(cash: CashRegister, movements: CashMovement[]) {
    let totalIncome = 0;
    let totalExpense = 0;

    movements.forEach((m) => {
      if (
        m.type === CashMovementType.SALE ||
        m.type === CashMovementType.INCOME ||
        m.type === CashMovementType.DEPOSIT
      ) {
        totalIncome += m.amount;
      }

      if (
        m.type === CashMovementType.PURCHASE ||
        m.type === CashMovementType.EXPENSE ||
        m.type === CashMovementType.WITHDRAWAL ||
        m.type === CashMovementType.RETURN
      ) {
        totalExpense += m.amount;
      }
    });

    const openingAmount = Number(cash.openingAmount);
    const expectedAmount = openingAmount + totalIncome - totalExpense;
    const actualAmount = Number(cash.actualAmount ?? 0);
    const difference = actualAmount - expectedAmount;

    return {
      openingAmount,
      totalIncome,
      totalExpense,
      expectedAmount,
      actualAmount,
      difference,
    };
  }

  // =========================
  // HELPERS (IGUALES AL LEGACY)
  // =========================

  private getMovementReference(movement: CashMovement) {
    if (movement.sale) return `Venta`;
    if (movement.purchase) return `Compra`;
    if (movement.saleReturn) return `Devolución`;
    if (movement.income) return movement.income.description || `Ingreso`;
    if (movement.expense) return movement.expense.description || `Gasto`;
    return movement.description ?? '-';
  }

  private mapMovementType(type: CashMovementType) {
    switch (type) {
      case CashMovementType.SALE:
        return 'Venta';
      case CashMovementType.PURCHASE:
        return 'Compra';
      case CashMovementType.RETURN:
        return 'Devolución';
      case CashMovementType.INCOME:
        return 'Ingreso';
      case CashMovementType.EXPENSE:
        return 'Gasto';
      case CashMovementType.OPENING:
        return 'Apertura';
      case CashMovementType.WITHDRAWAL:
        return 'Retiro';
      case CashMovementType.DEPOSIT:
        return 'Depósito';
      case CashMovementType.ADJUSTMENT:
        return 'Ajuste';
      default:
        return type;
    }
  }

  private getSignedAmount(type: CashMovementType, amount: number) {
    switch (type) {
      case CashMovementType.SALE:
      case CashMovementType.INCOME:
      case CashMovementType.DEPOSIT:
        return amount;
      case CashMovementType.PURCHASE:
      case CashMovementType.RETURN:
      case CashMovementType.EXPENSE:
      case CashMovementType.WITHDRAWAL:
        return -amount;
      case CashMovementType.OPENING:
      case CashMovementType.ADJUSTMENT:
        return 0;
      default:
        return amount;
    }
  }

  private formatDateOnly(date: Date | string) {
    const dt = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dt);
  }

  private splitDateTime(date: Date) {
    const d = new Date(date);
    return {
      date: new Intl.DateTimeFormat('es-ES').format(d),
      time: new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d),
    };
  }

  private getCurrencyFormat(currency: string) {
    const symbol =
      new Intl.NumberFormat('es-ES', { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? '$';
    return `"${symbol}"#,##0.00`;
  }

  private unlockSheetCells(sheet: ExcelJS.Worksheet) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.protection = { locked: false };
      });
    });
  }

  private lockCellRange(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        sheet.getCell(row, col).protection = { locked: true };
      }
    }
  }

  private async protectSheet(sheet: ExcelJS.Worksheet) {
    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: false,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      objects: false,
      scenarios: false,
    });
  }

  private insertLogo(
    sheet: ExcelJS.Worksheet,
    options?: {
      tlRow?: number;
      tlCol?: number;
      width?: number;
      height?: number;
    },
  ) {
    const logo = this.getLogoBuffer();
    if (!logo) return;

    const imageId = sheet.workbook.addImage({
      base64: logo.toString('base64'),
      extension: 'png',
    });

    sheet.addImage(imageId, {
      tl: {
        col: options?.tlCol ?? 0,
        row: options?.tlRow ?? 0,
      },
      ext: {
        width: options?.width ?? 160,
        height: options?.height ?? 60,
      },
    });
  }

  private getLogoBuffer(): Buffer | null {
    if (this.logoBuffer) return this.logoBuffer;

    const candidates = [
      path.resolve(process.cwd(), 'src', 'assets', 'balanzio.png'),
      path.resolve(process.cwd(), 'dist', 'src', 'assets', 'balanzio.png'),
      path.resolve(process.cwd(), 'assets', 'balanzio.png'),
    ];

    const logoPath = candidates.find((c) => existsSync(c));
    if (!logoPath) return null;

    this.logoBuffer = readFileSync(logoPath);
    return this.logoBuffer;
  }
}
