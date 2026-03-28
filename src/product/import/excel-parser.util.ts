import { Workbook } from 'exceljs';

export interface RawImportRow {
  rowNumber: number;
  name?: string;
  barcode?: string;
  costPrice?: number;
  salePrice?: number;
  stock?: number;
  shopId?: string;
  measurementUnitId?: string;
}

const COLUMN_ALIASES: Record<string, keyof Omit<RawImportRow, 'rowNumber'>> = {
  nombre: 'name',
  name: 'name',
  'codigo de barras': 'barcode',
  barcode: 'barcode',
  codigo: 'barcode',
  'precio costo': 'costPrice',
  costprice: 'costPrice',
  costo: 'costPrice',
  'precio venta': 'salePrice',
  saleprice: 'salePrice',
  venta: 'salePrice',
  stock: 'stock',
  cantidad: 'stock',
  tienda: 'shopId',
  shopid: 'shopId',
  'unidad de medida': 'measurementUnitId',
  measurementunitid: 'measurementUnitId',
};

const STRING_FIELDS = new Set<keyof Omit<RawImportRow, 'rowNumber'>>([
  'name',
  'barcode',
  'shopId',
  'measurementUnitId',
]);

export async function parseExcelBuffer(buffer: Buffer): Promise<RawImportRow[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const colMap = new Map<number, keyof Omit<RawImportRow, 'rowNumber'>>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    const field = COLUMN_ALIASES[key];
    if (field) colMap.set(col, field);
  });

  const rows: RawImportRow[] = [];

  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return;

    const entry: RawImportRow = { rowNumber: rowIndex };
    let hasData = false;

    row.eachCell((cell, col) => {
      const field = colMap.get(col);
      if (!field) return;

      const rawValue = cell.value;
      if (rawValue === null || rawValue === undefined || rawValue === '') return;

      hasData = true;

      if (STRING_FIELDS.has(field)) {
        (entry as any)[field] = String(rawValue).trim();
      } else {
        const num = Number(rawValue);
        if (!isNaN(num)) (entry as any)[field] = num;
      }
    });

    if (hasData) rows.push(entry);
  });

  return rows;
}
