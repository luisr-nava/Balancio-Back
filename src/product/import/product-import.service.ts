import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { JwtPayload } from 'jsonwebtoken';

import { Product } from '../entities/product.entity';
import { ShopProduct } from '../entities/shop-product.entity';
import {
  ProductHistory,
  ProductHistoryChangeType,
} from '../entities/product-history.entity';
import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { Shop } from '@/shop/entities/shop.entity';

import { parseExcelBuffer, RawImportRow } from './excel-parser.util';

const IMPORT_BATCH_SIZE = 10;
const MAX_ROWS = 5000;

interface GroupedEntry {
  name: string;
  normalizedName: string;
  barcode: string | null;
  measurementUnitId: string;
  shopEntries: Array<{
    shopId: string;
    costPrice: number;
    salePrice: number;
    stock: number;
    rowNumber: number;
  }>;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function validateRow(row: RawImportRow): string[] {
  const errs: string[] = [];
  if (!row.name?.trim()) errs.push('nombre requerido');
  if (!row.shopId?.trim()) errs.push('shopId requerido');
  if (row.costPrice === undefined || isNaN(row.costPrice) || row.costPrice < 0)
    errs.push('costPrice inválido');
  if (row.salePrice === undefined || isNaN(row.salePrice) || row.salePrice < 0)
    errs.push('salePrice inválido');
  if (row.stock !== undefined && (isNaN(row.stock) || row.stock < 0))
    errs.push('stock inválido');
  return errs;
}

function groupRows(rows: RawImportRow[]): Map<string, GroupedEntry> {
  const groups = new Map<string, GroupedEntry>();

  for (const row of rows) {
    const key = row.barcode?.trim()
      ? `barcode:${row.barcode.trim()}`
      : `name:${normalizeName(row.name!)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name: row.name!.trim(),
        normalizedName: normalizeName(row.name!),
        barcode: row.barcode?.trim() || null,
        measurementUnitId: row.measurementUnitId!,
        shopEntries: [],
      });
    }

    const group = groups.get(key)!;
    const duplicate = group.shopEntries.find((e) => e.shopId === row.shopId);
    if (!duplicate) {
      group.shopEntries.push({
        shopId: row.shopId!,
        costPrice: row.costPrice!,
        salePrice: row.salePrice!,
        stock: row.stock ?? 0,
        rowNumber: row.rowNumber,
      });
    }
  }

  return groups;
}

@Injectable()
export class ProductImportService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(MeasurementUnit)
    private readonly measurementUnitRepository: Repository<MeasurementUnit>,

    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
  ) {}

  async importFromExcel(
    buffer: Buffer,
    user: JwtPayload,
  ): Promise<ImportResult> {
    const rawRows = await parseExcelBuffer(buffer);

    if (!rawRows.length) {
      return { created: 0, updated: 0, skipped: 0, errors: [] };
    }

    if (rawRows.length > MAX_ROWS) {
      throw new BadRequestException(`Máximo ${MAX_ROWS} filas por importación`);
    }

    const errors: Array<{ row: number; reason: string }> = [];

    // 1. Row-level validation
    const validRows: RawImportRow[] = [];
    for (const row of rawRows) {
      const rowErrors = validateRow(row);
      if (rowErrors.length) {
        errors.push(
          ...rowErrors.map((reason) => ({ row: row.rowNumber, reason })),
        );
      } else {
        validRows.push(row);
      }
    }

    if (!validRows.length) {
      return { created: 0, updated: 0, skipped: 0, errors };
    }

    // 2. Resolve default measurementUnit (single query)
    const defaultUnit = await this.measurementUnitRepository.findOne({
      where: { isDefault: true },
      select: ['id'],
    });

    // 3. Batch-validate shops (single query)
    const shopIds = [...new Set(validRows.map((r) => r.shopId!))];
    const shops = await this.shopRepository.find({
      where: { id: In(shopIds) },
      select: ['id', 'currency'],
    });
    const shopCurrencyMap = new Map(shops.map((s) => [s.id, s.currency]));

    // 4. Batch-validate measurementUnits (single query)
    const muIds = [
      ...new Set(
        validRows
          .filter((r) => r.measurementUnitId)
          .map((r) => r.measurementUnitId!),
      ),
    ];
    const muSet = new Set<string>();
    if (muIds.length) {
      const units = await this.measurementUnitRepository.find({
        where: { id: In(muIds) },
        select: ['id'],
      });
      units.forEach((u) => muSet.add(u.id));
    }

    // 5. Filter processable rows
    const processableRows: RawImportRow[] = [];
    for (const row of validRows) {
      if (!shopCurrencyMap.has(row.shopId!)) {
        errors.push({
          row: row.rowNumber,
          reason: `Tienda ${row.shopId} no encontrada`,
        });
        continue;
      }
      if (row.measurementUnitId && !muSet.has(row.measurementUnitId)) {
        errors.push({
          row: row.rowNumber,
          reason: `Unidad de medida ${row.measurementUnitId} no encontrada`,
        });
        continue;
      }
      if (!row.measurementUnitId) {
        if (!defaultUnit) {
          errors.push({
            row: row.rowNumber,
            reason: 'No hay unidad de medida por defecto configurada',
          });
          continue;
        }
        row.measurementUnitId = defaultUnit.id;
      }
      processableRows.push(row);
    }

    if (!processableRows.length) {
      return { created: 0, updated: 0, skipped: 0, errors };
    }

    // 6. Group rows
    const groups = groupRows(processableRows);
    const groupArray = [...groups.values()];

    // 7. Bulk lookup existing products (2 queries, not N)
    const barcodes = groupArray.filter((g) => g.barcode).map((g) => g.barcode!);
    const names = groupArray.filter((g) => !g.barcode).map((g) => g.name);

    const [byBarcode, byName] = await Promise.all([
      barcodes.length
        ? this.productRepository.find({
            where: { barcode: In(barcodes) },
            relations: { shopProducts: true },
            select: {
              id: true,
              barcode: true,
              shopProducts: {
                id: true,
                shopId: true,
                barcode: true,
                stock: true,
              },
            },
          })
        : Promise.resolve([]),
      names.length
        ? this.productRepository.find({
            where: { name: In(names) },
            relations: { shopProducts: true },
            select: {
              id: true,
              name: true,
              barcode: true,
              shopProducts: {
                id: true,
                shopId: true,
                barcode: true,
                stock: true,
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const barcodeMap = new Map(byBarcode.map((p) => [p.barcode!, p]));
    const nameMap = new Map(byName.map((p) => [normalizeName(p.name), p]));

    // 8. Process in single transaction, batches of IMPORT_BATCH_SIZE
    let created = 0;
    let updated = 0;
    const skipped = 0;

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < groupArray.length; i += IMPORT_BATCH_SIZE) {
        const batch = groupArray.slice(i, i + IMPORT_BATCH_SIZE);

        for (const group of batch) {
          const existing = group.barcode
            ? barcodeMap.get(group.barcode)
            : nameMap.get(group.normalizedName);
          const defaultBarcode =
            group.barcode ??
            existing?.barcode ??
            (await this.resolveBarcodeForShop(
              manager,
              group.shopEntries[0].shopId,
            ));

          if (existing) {
            // Product exists — upsert ShopProducts
            for (const shopEntry of group.shopEntries) {
              const existingSP = existing.shopProducts.find(
                (sp) => sp.shopId === shopEntry.shopId,
              );

              if (existingSP) {
                // ShopProduct exists → update stock + prices
                await manager.update(ShopProduct, existingSP.id, {
                  barcode:
                    group.barcode ?? existingSP.barcode ?? defaultBarcode,
                  costPrice: shopEntry.costPrice,
                  salePrice: shopEntry.salePrice,
                  stock: shopEntry.stock,
                  isActive: true,
                });
                await manager.save(
                  ProductHistory,
                  manager.create(ProductHistory, {
                    shopProductId: existingSP.id,
                    userId: user.id,
                    changeType: ProductHistoryChangeType.UPDATED,
                    previousStock: existingSP.stock ?? null,
                    newStock: shopEntry.stock,
                    note: 'Importación Excel',
                  }),
                );
              } else {
                // ShopProduct does not exist → create
                const currency = shopCurrencyMap.get(shopEntry.shopId)!;
                const sp = await manager.save(
                  ShopProduct,
                  manager.create(ShopProduct, {
                    productId: existing.id,
                    shopId: shopEntry.shopId,
                    barcode: defaultBarcode,
                    costPrice: shopEntry.costPrice,
                    salePrice: shopEntry.salePrice,
                    stock: shopEntry.stock,
                    currency,
                    createdBy: user.id,
                  }),
                );
                await manager.save(
                  ProductHistory,
                  manager.create(ProductHistory, {
                    shopProductId: sp.id,
                    userId: user.id,
                    changeType: ProductHistoryChangeType.CREATED,
                    previousStock: null,
                    newStock: shopEntry.stock,
                    note: 'Importación Excel',
                  }),
                );
              }
            }
            updated++;
          } else {
            // New product
            const product = await manager.save(
              Product,
              manager.create(Product, {
                name: group.name,
                barcode: defaultBarcode,
                measurementUnitId: group.measurementUnitId,
                allowPriceOverride: false,
              }),
            );

            for (const shopEntry of group.shopEntries) {
              const currency = shopCurrencyMap.get(shopEntry.shopId)!;
              const sp = await manager.save(
                ShopProduct,
                manager.create(ShopProduct, {
                  productId: product.id,
                  shopId: shopEntry.shopId,
                  barcode: defaultBarcode,
                  costPrice: shopEntry.costPrice,
                  salePrice: shopEntry.salePrice,
                  stock: shopEntry.stock,
                  currency,
                  createdBy: user.id,
                }),
              );
              await manager.save(
                ProductHistory,
                manager.create(ProductHistory, {
                  shopProductId: sp.id,
                  userId: user.id,
                  changeType: ProductHistoryChangeType.CREATED,
                  previousStock: null,
                  newStock: shopEntry.stock,
                  note: 'Importación Excel',
                }),
              );
            }
            created++;
          }
        }
      }
    });

    return { created, updated, skipped, errors };
  }

  private async generateInternalBarcode(
    manager: EntityManager,
    shopId: string,
  ): Promise<string> {
    const last = await manager.findOne(ShopProduct, {
      where: { shopId },
      order: { createdAt: 'DESC' },
      select: ['barcode'],
    });

    const lastNumber = last?.barcode ? Number(last.barcode.split('-')[1]) : 0;

    return `BAL-${String(lastNumber + 1).padStart(8, '0')}`;
  }

  private async resolveBarcodeForShop(
    manager: EntityManager,
    shopId: string,
  ): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const generated = await this.generateInternalBarcode(manager, shopId);

      const exists = await manager.exists(ShopProduct, {
        where: { shopId, barcode: generated },
      });

      if (!exists) {
        return generated;
      }
    }

    throw new BadRequestException(
      'No se pudo asignar un código de barras único',
    );
  }
}
