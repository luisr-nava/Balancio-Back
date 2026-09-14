import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Catalog, CatalogProduct, CatalogSnapshot } from './entities/catalog.entity';
import { User } from '@/auth/entities/user.entity';
import { ShopService } from '@/shop/shop.service';
import { ProductService } from '@/product/product.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    private readonly shopService: ShopService,
    private readonly productService: ProductService,
  ) {}

  async generate(shopId: string, user: User) {
    await this.shopService.assertCanAccessShop(shopId, user);

    const result = await this.productService.getAll(shopId, user, 1, 10000);
    const products = result.data;

    const snapshotProducts: CatalogProduct[] = products
      .map((p: any): CatalogProduct | null => {
        const sp = p.shops?.find((s: any) => s.shopId === shopId);
        if (!sp) return null;
        if (!sp.isActive) return null;

        return {
          productId: p.id ?? '',
          shopProductId: sp.shopProductId ?? null,
          name: p.name ?? '',
          description: p.description ?? null,
          barcode: p.barcode ?? '',
          imageUrl: p.imageUrl ?? null,
          salePrice: sp.salePrice ?? 0,
          stock: sp.stock ?? null,
          currency: sp.currency ?? 'USD',
          isActive: true,
          measurementUnit: p.measurementUnit
            ? { id: p.measurementUnit.id, name: p.measurementUnit.name }
            : null,
          categoryName: null,
          supplierName: p.supplier?.name ?? null,
        };
      })
      .filter((p): p is CatalogProduct => p !== null);

    const snapshot: CatalogSnapshot = {
      version: 1,
      products: snapshotProducts,
    };

    const catalog = this.catalogRepository.create({
      shopId,
      snapshot,
      productCount: snapshotProducts.length,
    });

    const saved = await this.catalogRepository.save(catalog);

    return {
      id: saved.id,
      shopId: saved.shopId,
      productCount: saved.productCount,
      createdAt: saved.createdAt,
    };
  }

  async findOne(id: string, user: User) {
    const catalog = await this.catalogRepository.findOne({ where: { id } });

    if (!catalog) {
      throw new NotFoundException('Catálogo no encontrado');
    }

    await this.shopService.assertCanAccessShop(catalog.shopId, user);

    return catalog;
  }
}
