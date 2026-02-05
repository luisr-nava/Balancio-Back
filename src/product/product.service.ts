import { ConflictException, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ShopProduct } from './entities/shop-product.entity';
import { JwtPayload } from 'jsonwebtoken';
import { ProductHistory } from './entities/product-history.entity';
import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';
type DeleteScope = 'ONE' | 'MULTIPLE' | 'ALL';
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ShopProduct)
    private readonly shopProductRepository: Repository<ShopProduct>,

    @InjectRepository(ProductHistory)
    private readonly productHistoryRepository: Repository<ProductHistory>,

    @InjectRepository(MeasurementUnit) // 👈 ESTE
    private readonly measurementUnitRepository: Repository<MeasurementUnit>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
  ) {}
  async create(dto: CreateProductDto, user: JwtPayload) {
    const measurementUnitExists = await this.measurementUnitRepository.exist({
      where: { id: dto.measurementUnitId },
    });

    if (!measurementUnitExists) {
      throw new ConflictException('La unidad de medida no existe');
    }
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description,
      measurementUnitId: dto.measurementUnitId,
      allowPriceOverride: dto.allowPriceOverride ?? false,
    });

    const savedProduct = await this.productRepository.save(product);

    const shopIds = dto.shops.map((s) => s.shopId);

    const shops = await this.shopRepository.find({
      where: { id: In(shopIds) },
      select: ['id', 'currency'],
    });

    if (shops.length !== shopIds.length) {
      throw new ConflictException('Una o más tiendas no existen');
    }

    const shopCurrencyMap = new Map(
      shops.map((shop) => [shop.id, shop.currency]),
    );

    const shopProducts: ShopProduct[] = [];
    for (const shop of dto.shops) {
      const currency = shopCurrencyMap.get(shop.shopId);

      if (!currency) {
        throw new ConflictException('Moneda de la tienda no encontrada');
      }

      const barcode = await this.resolveBarcodeForShop(
        shop.shopId,
        dto.barcode, // 👈 UNO SOLO
      );

      const shopProduct = this.shopProductRepository.create({
        productId: savedProduct.id,
        shopId: shop.shopId,
        barcode,
        categoryId: shop.categoryId ?? null,
        supplierId: shop.supplierId ?? null,
        costPrice: shop.costPrice,
        salePrice: shop.salePrice,
        stock: shop.stock ?? null,
        currency,
        createdBy: user.id,
      });

      const savedShopProduct =
        await this.shopProductRepository.save(shopProduct);

      shopProducts.push(savedShopProduct);

      await this.productHistoryRepository.save(
        this.productHistoryRepository.create({
          shopProductId: savedShopProduct.id,
          userId: user.id,
          changeType: 'CREATED',
          previousStock: null,
          newStock: shop.stock ?? null,
          note: 'Producto creado',
        }),
      );
    }
    return {
      message: 'Producto creado correctamente',
      product: {
        ...savedProduct,
        shopProducts,
      },
    };
  }

  async getAll(
    shopId: string | undefined,
    user: JwtPayload,
    page = 1,
    limit = 20,
  ) {
    const [data, total] = await this.productRepository.findAndCount({
      relations: {
        measurementUnit: true,
        shopProducts: {
          shop: true,
          productHistories: true,
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    const transformed = data
      .map((product) => {
        const shopProducts = shopId
          ? product.shopProducts.filter((sp) => sp.shopId === shopId)
          : product.shopProducts;

        if (!shopProducts.length) return null;

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          measurementUnit: product.measurementUnit?.name,

          shops: shopProducts.map((sp) => ({
            id: sp.shop.id,
            name: sp.shop.name,
            currency: sp.currency,
            barcode: sp.barcode,
            costPrice: sp.costPrice,
            salePrice: sp.salePrice,
            stock: sp.stock,

            history: sp.productHistories
              .sort((a, b) => +b.createdAt - +a.createdAt)
              .map((h) => ({
                changeType: h.changeType,
                previousStock: h.previousStock,
                newStock: h.newStock,
                previousCost: h.previousCost,
                newCost: h.newCost,
                note: h.note,
                createdAt: h.createdAt,
              })),
          })),
        };
      })
      .filter(Boolean);

    return {
      data: transformed,
      pagination: {
        total: transformed.length,
        page,
        limit,
        totalPages: Math.ceil(transformed.length / limit),
      },
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  async updateShopProduct(
    productId: string,
    shopId: string,
    dto: UpdateProductDto,
    user: JwtPayload,
  ) {
    const shopProduct = await this.shopProductRepository.findOne({
      where: { productId, shopId },
    });

    if (!shopProduct) {
      throw new ConflictException('Producto no existe en la tienda');
    }

    // 🔎 Barcode único por tienda
    if (dto.barcode && dto.barcode !== shopProduct.barcode) {
      const exists = await this.shopProductRepository.exist({
        where: {
          shopId: shopProduct.shopId,
          barcode: dto.barcode,
        },
      });

      if (exists) {
        throw new ConflictException(
          'El código de barras ya existe en la tienda',
        );
      }
    }

    // 🧾 Historial previo
    const history = this.productHistoryRepository.create({
      shopProductId: shopProduct.id,
      userId: user.id,
      changeType: 'UPDATED',
      previousStock: shopProduct.stock,
      newStock: dto.stock ?? shopProduct.stock,
      previousCost: shopProduct.costPrice,
      newCost: dto.costPrice ?? shopProduct.costPrice,
      note: 'Actualización de producto',
    });

    // ✏️ Aplicar cambios
    Object.assign(shopProduct, {
      costPrice: dto.costPrice ?? shopProduct.costPrice,
      salePrice: dto.salePrice ?? shopProduct.salePrice,
      stock: dto.stock ?? shopProduct.stock,
      barcode: dto.barcode ?? shopProduct.barcode,
      categoryId: dto.categoryId ?? shopProduct.categoryId,
      supplierId: dto.supplierId ?? shopProduct.supplierId,
      isActive: dto.isActive ?? shopProduct.isActive,
    });

    await this.shopProductRepository.save(shopProduct);
    await this.productHistoryRepository.save(history);

    return {
      message: 'Producto actualizado correctamente',
      shopProductId: shopProduct.id,
    }; 
  }

  async deleteProduct(
    productId: string,
    user: JwtPayload,
    body?: { scope?: DeleteScope; shopIds?: string[] },
  ) {
    const shopProducts = await this.resolveTargetShopProducts(
      productId,
      user,
      body?.scope,
      body?.shopIds,
    );

    if (!shopProducts.length) {
      throw new ConflictException(
        'El producto no existe en las tiendas indicadas',
      );
    }

    for (const sp of shopProducts) {
      await this.deleteShopProduct(sp.id, user);
    }

    return {
      message: 'Operación realizada correctamente',
      affectedShopIds: shopProducts.map((sp) => sp.shopId),
    };
  }

  async bulkUpdateShopProducts(dto: BulkUpdateProductDto, user: JwtPayload) {
    if (user.role !== 'OWNER') {
      throw new ConflictException(
        'Solo el OWNER puede actualizar múltiples tiendas',
      );
    }

    const shopProducts = await this.shopProductRepository.find({
      where: { id: In(dto.shopProductIds) },
    });

    if (!shopProducts.length) {
      throw new ConflictException('No se encontraron productos');
    }

    for (const sp of shopProducts) {
      // Barcode único por tienda
      if (dto.barcode && dto.barcode !== sp.barcode) {
        const exists = await this.shopProductRepository.exist({
          where: { shopId: sp.shopId, barcode: dto.barcode },
        });

        if (exists) {
          throw new ConflictException(
            `Barcode duplicado en la tienda ${sp.shopId}`,
          );
        }
      }

      await this.productHistoryRepository.save(
        this.productHistoryRepository.create({
          shopProductId: sp.id,
          userId: user.id,
          changeType: 'BULK_UPDATED',
          previousStock: sp.stock,
          newStock: dto.stock ?? sp.stock,
          previousCost: sp.costPrice,
          newCost: dto.costPrice ?? sp.costPrice,
          note: 'Actualización múltiple',
        }),
      );

      Object.assign(sp, {
        costPrice: dto.costPrice ?? sp.costPrice,
        salePrice: dto.salePrice ?? sp.salePrice,
        stock: dto.stock ?? sp.stock,
        barcode: dto.barcode ?? sp.barcode,
        categoryId: dto.categoryId ?? sp.categoryId,
        supplierId: dto.supplierId ?? sp.supplierId,
      });

      await this.shopProductRepository.save(sp);
    }

    return {
      message: 'Productos actualizados correctamente',
      affected: shopProducts.length,
    };
  }

  async generateInternalBarcode(shopId: string): Promise<string> {
    const last = await this.shopProductRepository.findOne({
      where: { shopId },
      order: { createdAt: 'DESC' },
      select: ['barcode'],
    });

    const lastNumber = last?.barcode ? Number(last.barcode.split('-')[1]) : 0;

    return `BAL-${String(lastNumber + 1).padStart(8, '0')}`;
  }

  private async resolveBarcodeForShop(
    shopId: string,
    baseBarcode?: string,
  ): Promise<string> {
    // Si viene barcode global, intentamos usarlo
    if (baseBarcode) {
      const exists = await this.shopProductRepository.exist({
        where: { shopId, barcode: baseBarcode },
      });

      if (!exists) {
        return baseBarcode;
      }
    }

    // Si no vino o ya existe → generar siguiente
    for (let i = 0; i < 5; i++) {
      const generated = await this.generateInternalBarcode(shopId);

      const exists = await this.shopProductRepository.exist({
        where: { shopId, barcode: generated },
      });

      if (!exists) {
        return generated;
      }
    }

    throw new ConflictException('No se pudo asignar un código de barras único');
  }

  private async hasHistory(shopProductId: string): Promise<boolean> {
    return this.productHistoryRepository.exist({
      where: { shopProductId },
    });
  }

  private async resolveTargetShopProducts(
    productId: string,
    user: JwtPayload,
    scope?: DeleteScope,
    shopIds?: string[],
  ): Promise<ShopProduct[]> {
    if (user.role !== 'OWNER') {
      return this.shopProductRepository.find({
        where: { productId, shopId: user.shopId },
      });
    }

    if (scope === 'ALL') {
      return this.shopProductRepository.find({ where: { productId } });
    }

    if (scope === 'ONE' || scope === 'MULTIPLE') {
      if (!shopIds?.length) {
        throw new ConflictException('Debe especificar tiendas');
      }

      return this.shopProductRepository.find({
        where: { productId, shopId: In(shopIds) },
      });
    }

    // OWNER sin scope → solo su tienda
    return this.shopProductRepository.find({
      where: { productId, shopId: user.shopId },
    });
  }

  private async hasSales(shopProductId: string): Promise<boolean> {
    return this.productHistoryRepository.exist({
      where: {
        shopProductId,
        changeType: 'SALE',
      },
    });
  }
  private async hasMeaningfulHistory(shopProductId: string): Promise<boolean> {
    return this.productHistoryRepository.exist({
      where: {
        shopProductId,
        changeType: Not('CREATED'),
      },
    });
  }

  async deleteShopProduct(shopProductId: string, user: JwtPayload) {
    const shopProduct = await this.shopProductRepository.findOne({
      where: { id: shopProductId },
    });

    if (!shopProduct) return;

    const hasSales = await this.hasSales(shopProductId);

    if (hasSales) {
      if (!shopProduct.isActive) return;

      shopProduct.isActive = false;

      await this.shopProductRepository.save(shopProduct);

      await this.productHistoryRepository.save(
        this.productHistoryRepository.create({
          shopProductId,
          userId: user.id,
          changeType: 'DEACTIVATED',
          note: 'Producto desactivado (ventas asociadas)',
        }),
      );

      return;
    }
    await this.productHistoryRepository.delete({ shopProductId });
    await this.shopProductRepository.delete(shopProductId);
  }
}
