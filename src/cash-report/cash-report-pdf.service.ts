import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PdfPrinter from 'pdfmake';
import type {
  Content,
  ContentColumns,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { existsSync, readFileSync } from 'fs';
import path from 'node:path';

import {
  CashRegister,
  CashMovementType,
} from '@/cash-register/entities/cash-register.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';

const palette = {
  textMuted: '#9ca3af',
};

type MovementWithMeta = {
  movement: CashMovement;
  formattedDate: string;
  formattedTime: string;
  isClosing: boolean;
};

@Injectable()
export class CashReportPdfService {
  private logoDataUrl: string | null = null;

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
      throw new NotFoundException('Cash register not found');
    }

    const rawMovements = await this.cashMovementRepository.find({
      where: { cashRegisterId: cash.id },
      relations: ['sale', 'purchase', 'saleReturn', 'income', 'expense'],
      order: { createdAt: 'ASC' },
    });

    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const docDefinition = this.buildDocument(cash, rawMovements);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const buffer = await this.buildBuffer(pdfDoc);

    return {
      buffer,
      cash,
    };
  }

  private buildDocument(
    cash: CashRegister,
    rawMovements: CashMovement[],
  ): TDocumentDefinitions {
    const currency = cash.shop.currency ?? 'USD';

    const movements: MovementWithMeta[] = rawMovements.map((movement) => {
      const [formattedDate, formattedTime] = this.formatDateAndTime(
        movement.createdAt,
      );

      return {
        movement,
        formattedDate,
        formattedTime,
        isClosing: false,
      };
    });

    if (cash.closedAt) {
      const [formattedDate, formattedTime] = this.formatDateAndTime(
        cash.closedAt,
      );

      movements.push({
        movement: {
          id: 'cash-register-close',
          cashRegisterId: cash.id,
          shopId: cash.shopId,
          type: CashMovementType.ADJUSTMENT,
          amount: Number(cash.actualAmount ?? 0),
          description: 'Cierre de caja',
          saleId: null,
          purchaseId: null,
          saleReturnId: null,
          incomeId: null,
          expenseId: null,
          userId: cash.closedBy ?? cash.employeeId,
          createdAt: cash.closedAt,
          sale: null,
          purchase: null,
          saleReturn: null,
          income: null,
          expense: null,
        },
        formattedDate,
        formattedTime,
        isClosing: true,
      });
    }

    const totals = {
      sales: 0,
      purchases: 0,
      incomes: 0,
      expenses: 0,
      returns: 0,
      deposits: 0,
      withdrawals: 0,
    };

    rawMovements.forEach((m) => {
      switch (m.type) {
        case CashMovementType.SALE:
          totals.sales += m.amount;
          break;
        case CashMovementType.PURCHASE:
          totals.purchases += m.amount;
          break;
        case CashMovementType.INCOME:
          totals.incomes += m.amount;
          break;
        case CashMovementType.EXPENSE:
          totals.expenses += m.amount;
          break;
        case CashMovementType.RETURN:
          totals.returns += m.amount;
          break;
        case CashMovementType.DEPOSIT:
          totals.deposits += m.amount;
          break;
        case CashMovementType.WITHDRAWAL:
          totals.withdrawals += m.amount;
          break;
      }
    });

    const openingAmount = Number(cash.openingAmount);

    const expectedAmount =
      openingAmount +
      totals.sales +
      totals.incomes +
      totals.deposits -
      totals.purchases -
      totals.expenses -
      totals.withdrawals -
      totals.returns;

    const actualAmount = Number(cash.actualAmount ?? 0);

    const difference = actualAmount - expectedAmount;

    const differenceStatus =
      difference === 0
        ? 'Cuadre correcto'
        : difference > 0
          ? 'Sobrante'
          : 'Faltante';

    const movementRows: TableCell[][] = movements.map(
      ({ movement, formattedDate, formattedTime, isClosing }) => {
        const signedAmount =
          movement.type === CashMovementType.OPENING
            ? movement.amount
            : this.getSignedAmount(movement.type, movement.amount);

        return [
          {
            text: formattedDate,
            alignment: 'center',
          },
          {
            text: formattedTime,
            alignment: 'center',
          },
          {
            text: isClosing ? 'Cierre' : this.mapMovementType(movement.type),
          },
          {
            text: this.getMovementReference(movement),
          },
          {
            text: this.formatCurrency(signedAmount, currency),
            alignment: 'right',
          },
        ];
      },
    );

    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      footer: (currentPage, pageCount) => ({
        columns: [
          {
            text: 'Documento generado automáticamente por Balanzio',
            alignment: 'left',
          },
          {
            text: `${currentPage} / ${pageCount}`,
            alignment: 'right',
          },
        ],
        margin: [40, 0, 40, 0],
        fontSize: 9,
        color: palette.textMuted,
      }),
      content: [
        this.buildHeader(cash),

        {
          text: 'Resumen del arqueo',
          bold: true,
          fontSize: 14,
          margin: [0, 0, 0, 5],
        },

        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Monto de apertura' },
                {
                  text: this.formatCurrency(openingAmount, currency),
                  alignment: 'right',
                },
              ],
              [
                { text: 'Balance esperado' },
                {
                  text: this.formatCurrency(expectedAmount, currency),
                  alignment: 'right',
                },
              ],
              [
                { text: 'Monto real declarado' },
                {
                  text: this.formatCurrency(actualAmount, currency),
                  alignment: 'right',
                },
              ],
              [
                { text: 'Diferencia' },
                {
                  text: this.formatCurrency(difference, currency),
                  alignment: 'right',
                },
              ],
              [
                { text: 'Estado del cierre' },
                {
                  text: differenceStatus,
                  alignment: 'right',
                },
              ],
            ],
          },
        },

        {
          text: 'Movimientos',
          bold: true,
          fontSize: 14,
          margin: [0, 12, 0, 6],
        },

        {
          table: {
            headerRows: 1,
            widths: ['15%', '10%', '20%', '20%', '*'],
            body: [this.buildMovementsHeaderRow(), ...movementRows],
          },
        },
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
      },
    };
  }

  private buildHeader(cash: CashRegister): Content {
    const logo = this.getLogoDataUrl();
    const emissionDate = this.formatDateAndTime(new Date());

    const columns: ContentColumns = {
      columns: [
        logo
          ? {
              image: logo,
              width: 110,
              margin: [0, 0, 12, 0],
            }
          : { text: '' },
        {
          stack: [
            {
              text: cash.shop.name,
              style: 'headerTitle',
              bold: true,
              fontSize: 20,
            },
            {
              text: `Dirección: ${cash.shop.address || '-'}`,
              style: 'headerTitle',
            },
            { text: `Fecha: ${emissionDate}`, style: 'subHeader' },
            {
              text: `Responsable: ${cash.openedByName ?? '-'}`,
              style: 'subHeader',
            },
            {
              text: `Apertura: ${this.formatDateAndTime(cash.openedAt)}`,
              style: 'subHeader',
            },
            {
              text: `Cierre: ${this.formatDateAndTime(cash.closedAt!)}`,
              style: 'subHeader',
            },
          ],
          width: '*',
        },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 12],
    };

    return columns;
  }

  private buildMovementsHeaderRow(): TableCell[] {
    return [
      { text: 'Fecha', bold: true, alignment: 'center' },
      { text: 'Hora', bold: true, alignment: 'center' },
      { text: 'Tipo', bold: true, alignment: 'center' },
      { text: 'Referencia', bold: true, alignment: 'center' },
      {
        text: 'Monto',
        bold: true,
        alignment: 'right',
      },
    ];
  }

  private mapMovementType(type: CashMovementType): string {
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

  private getSignedAmount(type: CashMovementType, amount: number): number {
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
      default:
        return amount;
    }
  }

  private getMovementReference(movement: CashMovement): string {
    if (movement.sale) {
      return `Venta`;
    }
    if (movement.purchase) {
      return `Compra`;
    }
    if (movement.saleReturn) {
      return `Devolución`;
    }
    if (movement.income) {
      return movement.income.description ?? `Ingreso`;
    }
    if (movement.expense) {
      return movement.expense.description ?? `Gasto`;
    }
    return movement.description ?? '-';
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  private formatDateAndTime(date: Date | string): [string, string] {
    const dt = typeof date === 'string' ? new Date(date) : date;

    const datePart = new Intl.DateTimeFormat('es-ES').format(dt);

    const timePart = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt);

    return [datePart, timePart];
  }

  private getLogoDataUrl(): string | null {
    if (this.logoDataUrl) return this.logoDataUrl;

    const candidates = [
      path.resolve(process.cwd(), 'src', 'assets', 'balanzio.png'),
      path.resolve(process.cwd(), 'dist', 'src', 'assets', 'balanzio.png'),
      path.resolve(process.cwd(), 'assets', 'balanzio.png'),
    ];

    const logoPath = candidates.find((c) => existsSync(c)) ?? null;

    if (!logoPath) return null;

    const buffer = readFileSync(logoPath);

    this.logoDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

    return this.logoDataUrl;
  }

  private buildBuffer(pdfDoc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
