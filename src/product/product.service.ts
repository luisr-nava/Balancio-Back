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
      barcode: dto.barcode ?? null,
      measurementUnitId: dto.measurementUnitId,
      allowPriceOverride: dto.allowPriceOverride ?? false,
    });

    if (!product.barcode) {
      product.barcode = await this.generateInternalBarcode();
    }

    const savedProduct = await this.productRepository.save(product);
    if (dto.barcode) {
      const exists = await this.productRepository.findOne({
        where: { barcode: dto.barcode },
      });

      if (exists) {
        throw new ConflictException('El código de barras ya existe');
      }
    }

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

      const shopProduct = this.shopProductRepository.create({
        productId: savedProduct.id,
        shopId: shop.shopId,
        categoryId: shop.categoryId ?? null,
        supplierId: shop.supplierId ?? null,
        costPrice: shop.costPrice,
        salePrice: shop.salePrice,
        stock: shop.stock ?? null,
        currency, // 👈 viene de Shop
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
          barcode: product.barcode,
          measurementUnit: product.measurementUnit?.name,

          shops: shopProducts.map((sp) => ({
            id: sp.shop.id,
            name: sp.shop.name,
            currency: sp.currency,
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

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }

  async generateInternalBarcode(): Promise<string> {
    const [last] = await this.productRepository.find({
      where: { barcode: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    const lastNumber = last ? Number(last.barcode?.split('-')[1] ?? 0) : 0;

    return `BAL-${String(lastNumber + 1).padStart(8, '0')}`;
  }
}
