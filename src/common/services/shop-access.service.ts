import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User, UserRole } from '@/auth/entities/user.entity';

@Injectable()
export class ShopAccessService {
  constructor(
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async validateShopAccess(userId: string, shopId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }

    if (user.role === UserRole.OWNER) {
      return;
    }

    const userShop = await this.userShopRepo.findOne({
      where: { userId, shopId },
    });

    if (!userShop) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }
  }

  async getUserShopIds(userId: string): Promise<string[]> {
    const userShops = await this.userShopRepo.find({ where: { userId } });
    return userShops.map((us) => us.shopId);
  }

  async validateShopInUserScope(
    userId: string,
    shopId: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }

    if (user.role === UserRole.OWNER) {
      return;
    }

    const userShopIds = await this.getUserShopIds(userId);
    if (!userShopIds.includes(shopId)) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }
  }
}
