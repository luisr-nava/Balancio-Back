import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ShopProduct } from './entities/shop-product.entity';
import { JwtPayload } from 'jsonwebtoken';
import {
  ProductHistory,
  ProductHistoryChangeType,
} from './entities/product-history.entity';
import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';
import { DataSource } from 'typeorm';
import { CloudinaryService } from '@/common/services/cloudinary.service';
import { PurchaseItem } from '@/purchase/entities/purchase-item.entity';
import { PurchaseReturnItem } from '@/purchase-return/entities/purchase-return-item.entity';
import { ReplacementItem } from '@/purchase-return/entities/replacement-item.entity';
import { PromotionItem } from '@/promotion/entities/promotion-item.entity';
type DeleteScope = 'ONE' | 'MULTIPLE' | 'ALL';
const BULK_DELETE_BATCH_SIZE = 5;

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly dataSource: DataSource,

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

    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,

    @InjectRepository(PurchaseReturnItem)
    private readonly purchaseReturnItemRepository: Repository<PurchaseReturnItem>,

    @InjectRepository(ReplacementItem)
    private readonly replacementItemRepository: Repository<ReplacementItem>,

    @InjectRepository(PromotionItem)
    private readonly promotionItemRepository: Repository<PromotionItem>,
  ) {}
  async create(
    dto: CreateProductDto,
    user: JwtPayload,
    file?: { buffer: Buffer },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    let uploadedImage: { url: string; publicId: string } | undefined;
    try {
      const measurementUnitExists = await queryRunner.manager.exists(
        MeasurementUnit,
        { where: { id: dto.measurementUnitId } },
      );

      if (!measurementUnitExists) {
        throw new ConflictException('La unidad de medida no existe');
      }

      const product = queryRunner.manager.create(Product, {
        name: dto.name,
        description: dto.description,
        measurementUnitId: dto.measurementUnitId,
        allowPriceOverride: dto.allowPriceOverride ?? false,
      });

      const savedProduct = await queryRunner.manager.save(Product, product);

      const shopIds = dto.shops.map((s) => s.shopId);

      const shops = await queryRunner.manager.find(Shop, {
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

        const shopProduct = queryRunner.manager.create(ShopProduct, {
          productId: savedProduct.id,
          shopId: shop.shopId,
          barcode: dto.barcode,
          categoryId: shop.categoryId ?? null,
          supplierId: shop.supplierId ?? null,
          costPrice: shop.costPrice,
          salePrice: shop.salePrice,
          stock: shop.stock ?? null,
          currency,
          createdBy: user.id,
        });

        const savedShopProduct = await queryRunner.manager.save(
          ShopProduct,
          shopProduct,
        );

        shopProducts.push(savedShopProduct);

        await queryRunner.manager.save(
          ProductHistory,
          queryRunner.manager.create(ProductHistory, {
            shopProduct: { id: savedShopProduct.id },
            userId: user.id,
            changeType: ProductHistoryChangeType.CREATED,
            previousStock: null,
            newStock: shop.stock ?? null,
            note: 'Producto creado',
          }),
        );
      }

      if (file) {
        uploadedImage = await CloudinaryService.uploadProductImage(file);

        savedProduct.imageUrl = uploadedImage.url;
        savedProduct.imagePublicId = uploadedImage.publicId;

        await queryRunner.manager.save(Product, savedProduct);
      }
      await queryRunner.commitTransaction();

      return {
        message: 'Producto creado correctamente',
        product: {
          ...savedProduct,
          shopProducts,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (uploadedImage?.publicId) {
        await CloudinaryService.deleteImage(uploadedImage.publicId);
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAll(
    shopId: string | undefined,
    user: JwtPayload,
    page = 1,
    limit = 20,
    minStock?: number,
    maxStock?: number,
    search?: string,
    sortByCode?: 'ASC' | 'DESC',
    supplierId?: string,
    sortByStock?: 'ASC' | 'DESC',
    sortByPrice?: 'ASC' | 'DESC',
  ) {
    const products = await this.productRepository.find({
      relations: {
        measurementUnit: true,
        shopProducts: {
          shop: true,
          productHistories: true,
          supplier: true, // 👈 Asegurate de tener esta relación
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    let filteredProducts = products;

    // 🔎 Buscar por nombre
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter((p) =>
        p.name.toLowerCase().includes(searchLower),
      );
    }

    // 🏢 Filtrar por proveedor
    if (supplierId) {
      filteredProducts = filteredProducts.filter((product) =>
        product.shopProducts.some((sp) => sp.supplierId === supplierId),
      );
    }

    let transformed = filteredProducts
      .map((product) => {
        let shopProducts = shopId
          ? product.shopProducts.filter((sp) => sp.shopId === shopId)
          : product.shopProducts;

        // Siempre solo stock disponible
        shopProducts = shopProducts.filter((sp) => sp.stock! > 0);

        if (typeof minStock === 'number') {
          shopProducts = shopProducts.filter((sp) => sp.stock! >= minStock);
        }

        if (typeof maxStock === 'number') {
          shopProducts = shopProducts.filter((sp) => sp.stock! <= maxStock);
        }

        if (!shopProducts.length) return null;
        const selectedShopProduct = shopProducts[0];

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl ?? null,
          barcode: product.barcode,
          measurementUnit: product.measurementUnit
            ? {
                id: product.measurementUnit.id,
                name: product.measurementUnit.name,
              }
            : null,
          supplier: selectedShopProduct?.supplier
            ? {
                id: selectedShopProduct.supplier.id,
                name: selectedShopProduct.supplier.name,
              }
            : null,
          shops: shopProducts.map((sp) => ({
            shopProductId: sp.id,
            id: sp.shop.id,
            name: sp.shop.name,
            currency: sp.currency,
            costPrice: sp.costPrice,
            salePrice: sp.salePrice,
            stock: sp.stock,
            history: sp.productHistories,
          })),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // 📦 Orden por stock
    if (sortByStock) {
      transformed.sort((a, b) => {
        const stockA = a.shops[0]?.stock ?? 0;
        const stockB = b.shops[0]?.stock ?? 0;

        return sortByStock === 'ASC' ? stockA - stockB : stockB - stockA;
      });
    }

    // 💰 Orden por precio (salePrice)
    if (sortByPrice) {
      transformed.sort((a, b) => {
        const priceA = a.shops[0]?.salePrice ?? 0;
        const priceB = b.shops[0]?.salePrice ?? 0;

        return sortByPrice === 'ASC' ? priceA - priceB : priceB - priceA;
      });
    }

    const total = transformed.length;

    const paginated = transformed.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      total,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    user: JwtPayload,
    file?: { buffer: Buffer },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let uploadedImage: { url: string; publicId: string } | undefined;

    let previousImagePublicId: string | null = null;

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });

      if (!product) {
        throw new ConflictException('Producto no encontrado');
      }

      previousImagePublicId = product.imagePublicId ?? null;

      if (!dto.shops?.length) {
        throw new ConflictException('Debe especificar al menos una tienda');
      }
      Object.assign(product, {
        name: dto.name ?? product.name,
        description: dto.description ?? product.description,
        barcode: dto.barcode ?? product.barcode,
        measurementUnitId: dto.measurementUnitId ?? product.measurementUnitId,
      });

      await queryRunner.manager.save(Product, product);

      for (const shopDto of dto.shops) {
        const shopProduct = await queryRunner.manager.findOne(ShopProduct, {
          where: {
            productId,
            shopId: shopDto.shopId,
          },
        });

        if (!shopProduct) {
          throw new ConflictException(
            `El producto no existe en la tienda ${shopDto.shopId}`,
          );
        }

        await queryRunner.manager.save(
          ProductHistory,
          queryRunner.manager.create(ProductHistory, {
            shopProduct: { id: shopProduct.id },
            userId: user.id,
            changeType: ProductHistoryChangeType.UPDATED,
            previousStock: shopProduct.stock,
            newStock: shopDto.stock ?? shopProduct.stock,
            previousCost: shopProduct.costPrice,
            newCost: shopDto.costPrice ?? shopProduct.costPrice,
            note: 'Actualización de producto',
          }),
        );

        Object.assign(shopProduct, {
          costPrice: shopDto.costPrice ?? shopProduct.costPrice,
          salePrice: shopDto.salePrice ?? shopProduct.salePrice,
          stock: shopDto.stock ?? shopProduct.stock,
          categoryId: shopDto.categoryId ?? shopProduct.categoryId,
          supplierId: shopDto.supplierId ?? shopProduct.supplierId,
        });

        await queryRunner.manager.save(ShopProduct, shopProduct);
      }

      // 🔥 NUEVA IMAGEN
      if (file) {
        uploadedImage = await CloudinaryService.uploadProductImage(file);

        product.imageUrl = uploadedImage.url;
        product.imagePublicId = uploadedImage.publicId;

        await queryRunner.manager.save(Product, product);
      }

      await queryRunner.commitTransaction();

      // 🔥 BORRAR IMAGEN ANTERIOR SOLO DESPUÉS DEL COMMIT
      if (file && previousImagePublicId) {
        await CloudinaryService.deleteImage(previousImagePublicId);
      }

      return {
        message: 'Producto actualizado correctamente',
        affectedShops: dto.shops.map((s) => s.shopId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // 🔥 SI FALLA Y SUBIMOS NUEVA, LA BORRAMOS
      if (uploadedImage?.publicId) {
        await CloudinaryService.deleteImage(uploadedImage.publicId);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkDeleteProducts(productIds: string[], user: JwtPayload) {
    // Fix 4 — input validation
    if (!productIds.length) {
      return { deleted: [], deactivated: [], notFound: [], failed: [] };
    }
    if (productIds.length > 100) {
      throw new ConflictException('No se pueden eliminar más de 100 productos a la vez');
    }
    const uniqueIds = [...new Set(productIds)];

    const products = await this.productRepository.find({
      where: { id: In(uniqueIds) },
      relations: { shopProducts: true },
      select: {
        id: true,
        imagePublicId: true,
        shopProducts: { id: true, shopId: true },  // Fix 1 — needs shopId for tenant filter
      },
    });

    const foundIds = new Set(products.map((p) => p.id));
    const notFound = uniqueIds.filter((id) => !foundIds.has(id));

    const deleted: string[] = [];
    const deactivated: string[] = [];
    const failed: { productId: string; reason: string }[] = [];

    for (let i = 0; i < products.length; i += BULK_DELETE_BATCH_SIZE) {
      const batch = products.slice(i, i + BULK_DELETE_BATCH_SIZE);

      await Promise.all(
        batch.map(async (product) => {
          try {
            // Fix 1 — multi-tenant security: MANAGER only processes their shop
            const shopProductsToProcess =
              user.role !== 'OWNER'
                ? product.shopProducts.filter((sp) => sp.shopId === user.shopId)
                : product.shopProducts;

            await Promise.all(
              shopProductsToProcess.map((sp) =>
                this.deleteShopProduct(sp.id, user),
              ),
            );

            const remaining = await this.shopProductRepository.count({
              where: { productId: product.id },
            });

            if (remaining === 0) {
              await this.productRepository.delete(product.id);
              deleted.push(product.id);
              this.logger.debug(`Product ${product.id} deleted`);

              // Fix 3 — Cloudinary after DB delete, non-blocking
              if (product.imagePublicId) {
                CloudinaryService.deleteImage(product.imagePublicId).catch((err) =>
                  this.logger.warn(
                    `Failed to delete Cloudinary image ${product.imagePublicId}: ${err?.message}`,
                  ),
                );
              }
            } else {
              deactivated.push(product.id);
              this.logger.debug(`Product ${product.id} deactivated (${remaining} ShopProduct(s) remain)`);
            }
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            failed.push({ productId: product.id, reason });
            this.logger.warn(`Product ${product.id} failed: ${reason}`);
          }
        }),
      );
    }

    return { deleted, deactivated, notFound, failed };
  }

  async deleteProduct(
    productId: string,
    user: JwtPayload,
    body?: { scope?: DeleteScope; shopIds?: string[] },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let imagePublicId: string | null = null;

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });

      if (!product) {
        throw new ConflictException('Producto no encontrado');
      }

      imagePublicId = product.imagePublicId ?? null;

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

      // 🔥 Verificamos si quedan shopProducts
      const remaining = await queryRunner.manager.count(ShopProduct, {
        where: { productId },
      });

      if (remaining === 0) {
        await queryRunner.manager.delete(Product, productId);
      }

      await queryRunner.commitTransaction();

      // 🔥 Si no quedan tiendas y había imagen → borrarla
      if (remaining === 0 && imagePublicId) {
        await CloudinaryService.deleteImage(imagePublicId);
      }

      return {
        message: 'Operación realizada correctamente',
        affectedShopIds: shopProducts.map((sp) => sp.shopId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async generateInternalBarcode(
    queryRunner: any,
    shopId: string,
  ): Promise<string> {
    const last = await queryRunner.manager.findOne(ShopProduct, {
      where: { shopId },
      order: { createdAt: 'DESC' },
      select: ['barcode'],
    });

    const lastNumber = last?.barcode ? Number(last.barcode.split('-')[1]) : 0;

    return `BAL-${String(lastNumber + 1).padStart(8, '0')}`;
  }

  private async resolveBarcodeForShop(
    queryRunner: any,
    shopId: string,
    baseBarcode?: string,
  ): Promise<string> {
    if (baseBarcode) {
      const exists = await queryRunner.manager.exists(ShopProduct, {
        where: { shopId, barcode: baseBarcode },
      });

      if (!exists) {
        return baseBarcode;
      }
    }

    for (let i = 0; i < 5; i++) {
      const generated = await this.generateInternalBarcode(queryRunner, shopId);

      const exists = await queryRunner.manager.exists(ShopProduct, {
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
        shopProduct: { id: shopProductId },
        changeType: ProductHistoryChangeType.SALE,
      },
    });
  }
  private async hasMeaningfulHistory(shopProductId: string): Promise<boolean> {
    return this.productHistoryRepository.exist({
      where: {
        shopProduct: { id: shopProductId },
        changeType: Not(ProductHistoryChangeType.CREATED),
      },
    });
  }

  private async hasPurchases(shopProductId: string): Promise<boolean> {
    return this.purchaseItemRepository.exist({
      where: { shopProduct: { id: shopProductId } },
    });
  }

  private async hasPurchaseReturns(shopProductId: string): Promise<boolean> {
    return this.purchaseReturnItemRepository.exist({
      where: { shopProductId },
    });
  }

  private async hasReplacementItems(shopProductId: string): Promise<boolean> {
    return this.replacementItemRepository.exist({
      where: { shopProductId },
    });
  }

  private async hasPromotionItems(shopProductId: string): Promise<boolean> {
    return this.promotionItemRepository.exist({
      where: { shopProductId },
    });
  }

  async deleteShopProduct(shopProductId: string, user: JwtPayload) {
    const shopProduct = await this.shopProductRepository.findOne({
      where: { id: shopProductId },
    });

    if (!shopProduct) return;

    const [hasSales, hasPurchases, hasPurchaseReturns, hasReplacements, hasPromotions] =
      await Promise.all([
        this.hasSales(shopProductId),
        this.hasPurchases(shopProductId),
        this.hasPurchaseReturns(shopProductId),
        this.hasReplacementItems(shopProductId),
        this.hasPromotionItems(shopProductId),
      ]);

    if (hasSales || hasPurchases || hasPurchaseReturns || hasReplacements || hasPromotions) {
      if (!shopProduct.isActive) return;

      shopProduct.isActive = false;

      await this.shopProductRepository.save(shopProduct);

      await this.productHistoryRepository.save(
        this.productHistoryRepository.create({
          shopProductId,
          userId: user.id,
          changeType: ProductHistoryChangeType.DEACTIVATED,
          note: 'Producto desactivado (ventas o compras asociadas)',
        }),
      );

      return;
    }
    await this.productHistoryRepository.delete({
      shopProduct: { id: shopProductId },
    });
    await this.shopProductRepository.delete(shopProductId);
  }
}
